import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

import { SUPABASE_KEY, SUPABASE_URL, supabase } from './supabase';

export const IMAGE_BUCKET = 'product-images';
const MAX_SIZE = 1200;

/** Lets the user take or choose a square photo, then compresses it. Returns a local file URI. */
export async function pickProductImage(source: 'camera' | 'library'): Promise<string | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera not allowed', 'Allow camera access in your phone settings to take photos.');
      return null;
    }
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > MAX_SIZE) {
    context.resize(asset.width >= asset.height ? { width: MAX_SIZE } : { height: MAX_SIZE });
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });
  return saved.uri;
}

/** Uploads a compressed local JPEG and returns its storage path. */
export async function uploadProductImage(localUri: string): Promise<string> {
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
  const body = await fetch(localUri).then((res) => res.arrayBuffer());
  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, body, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}

export async function deleteProductImage(path: string): Promise<void> {
  await supabase.storage.from(IMAGE_BUCKET).remove([path]);
}

/**
 * Source for expo-image that reads from the private bucket with the user's
 * token. The cache key is the path, so images stay cached as tokens rotate,
 * and a replaced image (new path) is fetched fresh.
 */
export function productImageSource(path: string, accessToken: string | undefined) {
  return {
    uri: `${SUPABASE_URL}/storage/v1/object/authenticated/${IMAGE_BUCKET}/${path}`,
    headers: { Authorization: `Bearer ${accessToken ?? ''}`, apikey: SUPABASE_KEY },
    cacheKey: path,
  };
}

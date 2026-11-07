import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

import { SUPABASE_KEY, SUPABASE_URL, supabase } from './supabase';

export const IMAGE_BUCKET = 'product-images';
const MAX_SIZE = 1200;

export type PickedImage = {
  /** Local file URI, for previewing. */
  uri: string;
  /** The compressed JPEG, base64 encoded, for uploading. */
  base64: string;
};

/** Lets the user take or choose a square photo, then compresses it to JPEG. */
export async function pickProductImage(source: 'camera' | 'library'): Promise<PickedImage | null> {
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
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  if (!saved.base64) throw new Error('Could not read the photo.');
  return { uri: saved.uri, base64: saved.base64 };
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Uploads a compressed JPEG and returns its storage path.
 * Bytes come from base64 because fetch(fileUri).arrayBuffer() returns a tiny
 * placeholder instead of the file contents on React Native.
 */
export async function uploadProductImage(image: PickedImage): Promise<string> {
  const body = base64ToBytes(image.base64);
  if (body.length < 1000) throw new Error('Could not read the photo.');
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, body, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}

export const MAX_IMAGES = 8;

export async function deleteProductImages(paths: string[]): Promise<void> {
  if (paths.length) await supabase.storage.from(IMAGE_BUCKET).remove(paths);
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

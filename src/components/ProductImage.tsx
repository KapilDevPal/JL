import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useAuth } from '@/lib/auth';
import { productImageSource } from '@/lib/images';
import { colors } from './theme';

type Props = {
  /** Storage path of an uploaded image. */
  path?: string | null;
  /** Local file URI, used to preview an image before it is uploaded. */
  localUri?: string | null;
  style: StyleProp<ViewStyle>;
};

export function ProductImage({ path, localUri, style }: Props) {
  const { session } = useAuth();
  const source = localUri ? { uri: localUri } : path ? productImageSource(path, session?.access_token) : null;

  return (
    <View style={[styles.frame, style]}>
      {source ? (
        <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      ) : (
        <Ionicons name="diamond-outline" size={32} color={colors.champagne} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: colors.champagneSoft,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export interface PaletteFilter {
  id: string
  label: {
    en: string
    ja: string
    it: string
    es: string
    fr: string
  }
  hex: string
}

export function getAllPaletteFilters(): PaletteFilter[] {
  return [
    ...getPaletteColorFilter(),
    ...getPaletteSeasonFilter(),
    ...getPaletteStyleFilter(),
    ...getPaletteToneFilter()
  ].sort((a, b) => a.id.localeCompare(b.id));
}

export function getPaletteColorFilter(): PaletteFilter[] {
  return [
    { id: 'amber', label: { en: 'Amber', ja: 'アンバー', it: 'Ambra', es: 'Ámbar', fr: 'Ambre' }, hex: '#FFBF00' },
    { id: 'aqua', label: { en: 'Aqua', ja: 'アクア', it: 'Acqua', es: 'Aguamarina', fr: 'Aqua' }, hex: '#00FFFF' },
    { id: 'apricot', label: { en: 'Apricot', ja: 'アプリコット', it: 'Albicocca', es: 'Albaricoque', fr: 'Abricot' }, hex: '#FBCEB1' },
    { id: 'auburn', label: { en: 'Auburn', ja: '赤褐色', it: 'Auburn', es: 'Caoba', fr: 'Acajou' }, hex: '#A52A2A' },
    { id: 'beige', label: { en: 'Beige', ja: 'ベージュ', it: 'Beige', es: 'Beige', fr: 'Beige' }, hex: '#F5F5DC' },
    { id: 'black', label: { en: 'Black', ja: '黒', it: 'Nero', es: 'Negro', fr: 'Noir' }, hex: '#000000' },
    { id: 'blue', label: { en: 'Blue', ja: '青', it: 'Blu', es: 'Azul', fr: 'Bleu' }, hex: '#0000FF' },
    { id: 'brown', label: { en: 'Brown', ja: '茶色', it: 'Marrone', es: 'Marrón', fr: 'Marron' }, hex: '#964B00' },
    { id: 'burgundy', label: { en: 'Burgundy', ja: 'バーガンディ', it: 'Borgogna', es: 'Burdeos', fr: 'Bordeaux' }, hex: '#800020' },
    { id: 'coral', label: { en: 'Coral', ja: 'コーラル', it: 'Corallo', es: 'Coral', fr: 'Corail' }, hex: '#FF7F50' },
    { id: 'cream', label: { en: 'Cream', ja: 'クリーム', it: 'Crema', es: 'Crema', fr: 'Crème' }, hex: '#FFFDD0' },
    { id: 'crimson', label: { en: 'Crimson', ja: 'クリムゾン', it: 'Cremisi', es: 'Carmesí', fr: 'Cramoisi' }, hex: '#DC143C' },
    { id: 'fuschia', label: { en: 'Fuschia', ja: 'フクシア', it: 'Fucsia', es: 'Fucsia', fr: 'Fuchsia' }, hex: '#FF00FF' },
    { id: 'gold', label: { en: 'Gold', ja: 'ゴールド', it: 'Oro', es: 'Dorado', fr: 'Or' }, hex: '#FFD700' },
    { id: 'gray', label: { en: 'Gray', ja: '灰色', it: 'Grigio', es: 'Gris', fr: 'Gris' }, hex: '#808080' },
    { id: 'green', label: { en: 'Green', ja: '緑', it: 'Verde', es: 'Verde', fr: 'Vert' }, hex: '#008000' },
    { id: 'hazel', label: { en: 'Hazel', ja: 'ヘーゼル', it: 'Nocciola', es: 'Avellana', fr: 'Noisette' }, hex: '#8E7618' },
    { id: 'indigo', label: { en: 'Indigo', ja: 'インディゴ', it: 'Indaco', es: 'Índigo', fr: 'Indigo' }, hex: '#4B0082' },
    { id: 'ivory', label: { en: 'Ivory', ja: 'アイボリー', it: 'Avorio', es: 'Marfil', fr: 'Ivoire' }, hex: '#FFFFF0' },
    { id: 'lavender', label: { en: 'Lavender', ja: 'ラベンダー', it: 'Lavanda', es: 'Lavanda', fr: 'Lavande' }, hex: '#E6E6FA' },
    { id: 'lilac', label: { en: 'Lilac', ja: 'ライラック', it: 'Lillà', es: 'Lila', fr: 'Lilas' }, hex: '#C8A2C8' },
    { id: 'magenta', label: { en: 'Magenta', ja: 'マゼンタ', it: 'Magenta', es: 'Magenta', fr: 'Magenta' }, hex: '#FF00FF' },
    { id: 'maroon', label: { en: 'Maroon', ja: '栗色', it: 'Bordeaux', es: 'Granate', fr: 'Marron foncé' }, hex: '#800000' },
    { id: 'mint', label: { en: 'Mint', ja: 'ミント', it: 'Menta', es: 'Menta', fr: 'Menthe' }, hex: '#98FF98' },
    { id: 'peach', label: { en: 'Peach', ja: 'ピーチ', it: 'Pesca', es: 'Melocotón', fr: 'Pêche' }, hex: '#FFDAB9' },
    { id: 'pink', label: { en: 'Pink', ja: 'ピンク', it: 'Rosa', es: 'Rosa', fr: 'Rose' }, hex: '#FFC0CB' },
    { id: 'purple', label: { en: 'Purple', ja: '紫', it: 'Viola', es: 'Púrpura', fr: 'Violet' }, hex: '#800080' },
    { id: 'red', label: { en: 'Red', ja: '赤', it: 'Rosso', es: 'Rojo', fr: 'Rouge' }, hex: '#FF0000' },
    { id: 'sage', label: { en: 'Sage', ja: 'セージ', it: 'Salvia', es: 'Salvia', fr: 'Sauge' }, hex: '#BCB88A' },
    { id: 'tan', label: { en: 'Tan', ja: 'タン', it: 'Tan', es: 'Canela', fr: 'Beige doré' }, hex: '#D2B48C' },
    { id: 'teal', label: { en: 'Teal', ja: 'ティール', it: 'Verde acqua', es: 'Verde azulado', fr: 'Sarcelle' }, hex: '#008080' },
    { id: 'turquoise', label: { en: 'Turquoise', ja: 'ターコイズ', it: 'Turchese', es: 'Turquesa', fr: 'Turquoise' }, hex: '#40E0D0' },
    { id: 'violet', label: { en: 'Violet', ja: 'スミレ', it: 'Viola', es: 'Violeta', fr: 'Violet' }, hex: '#EE82EE' },
    { id: 'white', label: { en: 'White', ja: '白', it: 'Bianco', es: 'Blanco', fr: 'Blanc' }, hex: '#FFFFFF' },
    { id: 'yellow', label: { en: 'Yellow', ja: '黄色', it: 'Giallo', es: 'Amarillo', fr: 'Jaune' }, hex: '#FFFF00' }
  ].sort((a, b) => a.id.localeCompare(b.id));
}

export function getPaletteToneFilter(): PaletteFilter[] {
  return [
    { id: 'warm', label: { en: 'Warm', ja: 'ウォーム', it: 'Caldo', es: 'Cálido', fr: 'Chaud' }, hex: '#FF7F50' },
    { id: 'cool', label: { en: 'Cool', ja: 'クール', it: 'Fresco', es: 'Frío', fr: 'Froid' }, hex: '#4682B4' },
    { id: 'earthy', label: { en: 'Earthy', ja: 'アーシー', it: 'Terroso', es: 'Terroso', fr: 'Terreux' }, hex: '#8B4513' },
    { id: 'pastel', label: { en: 'Pastel', ja: 'パステル', it: 'Pastello', es: 'Pastel', fr: 'Pastel' }, hex: '#FFB6C1' },
    { id: 'vibrant', label: { en: 'Vibrant', ja: 'ビビッド', it: 'Vivace', es: 'Vibrante', fr: 'Vibrant' }, hex: '#FF1493' },
    { id: 'bright', label: { en: 'Bright', ja: 'ブライト', it: 'Brillante', es: 'Brillante', fr: 'Éclatant' }, hex: '#FFD700' },
    { id: 'dark', label: { en: 'Dark', ja: 'ダーク', it: 'Scuro', es: 'Oscuro', fr: 'Sombre' }, hex: '#000000' },
    { id: 'light', label: { en: 'Light', ja: 'ライト', it: 'Chiaro', es: 'Claro', fr: 'Clair' }, hex: '#F5F5DC' },
    { id: 'soft', label: { en: 'Soft', ja: 'ソフト', it: 'Morbido', es: 'Suave', fr: 'Doux' }, hex: '#FFE4E1' },
    { id: 'rainbow', label: { en: 'Rainbow', ja: 'レインボー', it: 'Arcobaleno', es: 'Arcoíris', fr: 'Arc-en-ciel' }, hex: '#FF4500' },
    { id: 'neutral', label: { en: 'Neutral', ja: 'ニュートラル', it: 'Neutro', es: 'Neutro', fr: 'Neutre' }, hex: '#808080' },
    { id: 'muted', label: { en: 'Muted', ja: 'ミュート', it: 'Smutato', es: 'Apagado', fr: 'Atténué' }, hex: '#696969' },
    { id: 'monochromatic', label: { en: 'Monochromatic', ja: 'モノクローム', it: 'Monocromatico', es: 'Monocromático', fr: 'Monochromatique' }, hex: '#2F4F4F' },
    { id: 'deep', label: { en: 'Deep', ja: 'ディープ', it: 'Profondo', es: 'Profundo', fr: 'Profond' }, hex: '#4B0082' },
    { id: 'high-contrast', label: { en: 'High Contrast', ja: 'ハイコントラスト', it: 'Alto Contrasto', es: 'Alto contraste', fr: 'Contraste élevé' }, hex: '#FFFFFF' },
    { id: 'trending', label: { en: 'Trending', ja: 'トレンド', it: 'Tendenze', es: 'Tendencias', fr: 'Tendances' }, hex: '#FF1B6B' },
    { id: 'neon', label: { en: 'Neon', ja: 'ネオン', it: 'Neon', es: 'Neón', fr: 'Néon' }, hex: '#39FF14' },
    { id: 'corporate', label: { en: 'Corporate', ja: 'コーポレート', it: 'Corporativo', es: 'Corporativo', fr: 'Corporate' }, hex: '#003366' }
  ].sort((a, b) => a.id.localeCompare(b.id));
}

export function getPaletteStyleFilter(): PaletteFilter[] {
  return [
    { id: 'boho', label: { en: 'Boho', ja: 'ボヘミアン', it: 'Boho', es: 'Boho', fr: 'Bohème' }, hex: '#D2B48C' },
    { id: '60s', label: { en: '60s', ja: '60年代', it: 'Anni 60', es: 'Años 60', fr: 'Années 60' }, hex: '#FF6347' },
    { id: '70s', label: { en: '70s', ja: '70年代', it: 'Anni 70', es: 'Años 70', fr: 'Années 70' }, hex: '#DAA520' },
    { id: '80s', label: { en: '80s', ja: '80年代', it: 'Anni 80', es: 'Años 80', fr: 'Années 80' }, hex: '#FF69B4' },
    { id: '90s', label: { en: '90s', ja: '90年代', it: 'Anni 90', es: 'Años 90', fr: 'Années 90' }, hex: '#32CD32' },
    { id: 'y2k', label: { en: 'Y2K', ja: 'Y2K', it: 'Y2K', es: 'Y2K', fr: 'Y2K' }, hex: '#ADD8E6' },
    { id: 'retro', label: { en: 'Retro', ja: 'レトロ', it: 'Retrò', es: 'Retro', fr: 'Rétro' }, hex: '#F08080' },
    { id: 'sunset', label: { en: 'Sunset', ja: 'サンセット', it: 'Tramonto', es: 'Atardecer', fr: 'Coucher de soleil' }, hex: '#FF4500' },
    { id: 'skin', label: { en: 'Skin', ja: 'スキン', it: 'Pelle', es: 'Piel', fr: 'Peau' }, hex: '#FFE4C4' },
    { id: 'aesthetic', label: { en: 'Aesthetic', ja: 'エステティック', it: 'Estetico', es: 'Estético', fr: 'Esthétique' }, hex: '#FFC0CB' },
    { id: 'vintage', label: { en: 'Vintage', ja: 'ビンテージ', it: 'Vintage', es: 'Vintage', fr: 'Vintage' }, hex: '#C0C0C0' },
    { id: 'forest', label: { en: 'Forest', ja: 'フォレスト', it: 'Foresta', es: 'Bosque', fr: 'Forêt' }, hex: '#228B22' },
    { id: 'fun', label: { en: 'Fun', ja: 'ファン', it: 'Divertente', es: 'Divertido', fr: 'Amusant' }, hex: '#FFD700' },
    { id: 'minimalist', label: { en: 'Minimalist', ja: 'ミニマリスト', it: 'Minimalista', es: 'Minimalista', fr: 'Minimaliste' }, hex: '#F5F5F5' },
    { id: 'feminine', label: { en: 'Feminine', ja: 'フェミニン', it: 'Femminile', es: 'Femenino', fr: 'Féminin' }, hex: '#FFB6C1' },
    { id: 'royal', label: { en: 'Royal', ja: 'ロイヤル', it: 'Reale', es: 'Real', fr: 'Royal' }, hex: '#4169E1' },
    { id: 'wine', label: { en: 'Wine', ja: 'ワイン', it: 'Vino', es: 'Vino', fr: 'Vin' }, hex: '#722F37' },
    { id: 'beach', label: { en: 'Beach', ja: 'ビーチ', it: 'Spiaggia', es: 'Playa', fr: 'Plage' }, hex: '#87CEFA' },
    { id: 'desert', label: { en: 'Desert', ja: '砂漠', it: 'Deserto', es: 'Desierto', fr: 'Désert' }, hex: '#EDC9AF' },
    { id: 'tropical', label: { en: 'Tropical', ja: 'トロピカル', it: 'Tropicale', es: 'Tropical', fr: 'Tropical' }, hex: '#FF7F50' },
    { id: 'modern', label: { en: 'Modern', ja: 'モダン', it: 'Moderno', es: 'Moderno', fr: 'Moderne' }, hex: '#A9A9A9' },
    { id: 'ocean', label: { en: 'Ocean', ja: 'オーシャン', it: 'Oceano', es: 'Océano', fr: 'Océan' }, hex: '#4682B4' },
    { id: 'cyberpunk', label: { en: 'Cyberpunk', ja: 'サイバーパンク', it: 'Cyberpunk', es: 'Ciberpunk', fr: 'Cyberpunk' }, hex: '#9400D3' },
    { id: 'space', label: { en: 'Space', ja: 'スペース', it: 'Spazio', es: 'Espacio', fr: 'Espace' }, hex: '#000080' },
    { id: 'nature', label: { en: 'Nature', ja: 'ネイチャー', it: 'Natura', es: 'Naturaleza', fr: 'Nature' }, hex: '#6B8E23' },
    { id: 'coastal', label: { en: 'Coastal', ja: 'コースタル', it: 'Costiero', es: 'Costero', fr: 'Côtier' }, hex: '#B0C4DE' },
    { id: 'luxury', label: { en: 'Luxury', ja: 'ラグジュアリー', it: 'Lusso', es: 'Lujo', fr: 'Luxe' }, hex: '#B8860B' },
    { id: 'fire', label: { en: 'Fire', ja: 'ファイア', it: 'Fuoco', es: 'Fuego', fr: 'Feu' }, hex: '#FF4500' },
    { id: 'rustic', label: { en: 'Rustic', ja: 'ラスティック', it: 'Rustico', es: 'Rústico', fr: 'Rustique' }, hex: '#8B4513' },
    { id: 'moon', label: { en: 'Moon', ja: 'ムーン', it: 'Luna', es: 'Luna', fr: 'Lune' }, hex: '#F8F8FF' },
    { id: 'hippie', label: { en: 'Hippie', ja: 'ヒッピー', it: 'Hippie', es: 'Hippie', fr: 'Hippie' }, hex: '#FF4500' },
    { id: 'psychedelic', label: { en: 'Psychedelic', ja: 'サイケデリック', it: 'Psichedelico', es: 'Psicodélico', fr: 'Psychédélique' }, hex: '#FF00FF' },
    { id: 'flower', label: { en: 'Flower', ja: 'フラワー', it: 'Fiore', es: 'Flor', fr: 'Fleur' }, hex: '#FF69B4' },
    { id: 'masculine', label: { en: 'Masculine', ja: 'マスキュリン', it: 'Maschile', es: 'Masculino', fr: 'Masculin' }, hex: '#2F4F4F' },
    { id: 'mountain', label: { en: 'Mountain', ja: 'マウンテン', it: 'Montagna', es: 'Montaña', fr: 'Montagne' }, hex: '#2E8B57' },
    { id: 'midnight', label: { en: 'Midnight', ja: 'ミッドナイト', it: 'Mezzanotte', es: 'Medianoche', fr: 'Minuit' }, hex: '#191970' },
    { id: 'Scandinavian', label: { en: 'Scandinavian', ja: 'スカンジナビア', it: 'Scandinavo', es: 'Escandinavo', fr: 'Scandinave' }, hex: '#D3D3D3' },
    { id: 'wood', label: { en: 'Wood', ja: 'ウッド', it: 'Legno', es: 'Madera', fr: 'Bois' }, hex: '#8B4513' },
    { id: 'garden', label: { en: 'Garden', ja: 'ガーデン', it: 'Giardino', es: 'Jardín', fr: 'Jardin' }, hex: '#228B22' },
    { id: 'elegant', label: { en: 'Elegant', ja: 'エレガント', it: 'Elegante', es: 'Elegante', fr: 'Élégant' }, hex: '#DAA520' },
    { id: 'cat', label: { en: 'Cat', ja: 'キャット', it: 'Gatto', es: 'Gato', fr: 'Chat' }, hex: '#C0C0C0' },
    { id: 'metal', label: { en: 'Metal', ja: 'メタル', it: 'Metallo', es: 'Metal', fr: 'Métal' }, hex: '#808080' },
    { id: 'sun', label: { en: 'Sun', ja: 'サン', it: 'Sole', es: 'Sol', fr: 'Soleil' }, hex: '#FFD700' },
    { id: 'medieval', label: { en: 'Medieval', ja: '中世', it: 'Medievale', es: 'Medieval', fr: 'Médiéval' }, hex: '#A52A2A' },
    { id: 'sunflower', label: { en: 'Sunflower', ja: 'ヒマワリ', it: 'Girasole', es: 'Girasol', fr: 'Tournesol' }, hex: '#FFD700' },
    { id: 'japanese', label: { en: 'Japanese', ja: '日本', it: 'Giapponese', es: 'Japonés', fr: 'Japonais' }, hex: '#DC143C' },
    { id: 'hawaii', label: { en: 'Hawaii', ja: 'ハワイ', it: 'Hawaii', es: 'Hawái', fr: 'Hawaï' }, hex: '#FF6347' },
    { id: 'night-sky', label: { en: 'Night Sky', ja: 'ナイトスカイ', it: 'Cielo Notturno', es: 'Cielo nocturno', fr: 'Ciel nocturne' }, hex: '#191970' },
    { id: 'zombie', label: { en: 'Zombie', ja: 'ゾンビ', it: 'Zombie', es: 'Zombi', fr: 'Zombie' }, hex: '#708090' }
  ].sort((a, b) => a.id.localeCompare(b.id));
}

export function getPaletteSeasonFilter(): PaletteFilter[] {
  return [
    { id: 'winter', label: { en: 'Winter', ja: 'ウィンター', it: 'Inverno', es: 'Invierno', fr: 'Hiver' }, hex: '#00BFFF' },
    { id: 'fall', label: { en: 'Fall', ja: 'フォール', it: 'Autunno', es: 'Otoño', fr: 'Automne' }, hex: '#D2691E' },
    { id: 'autumn', label: { en: 'Autumn', ja: 'オータム', it: 'Autunno', es: 'Otoño', fr: 'Automne' }, hex: '#FF8C00' },
    { id: 'spring', label: { en: 'Spring', ja: 'スプリング', it: 'Primavera', es: 'Primavera', fr: 'Printemps' }, hex: '#00FF7F' },
    { id: 'summer', label: { en: 'Summer', ja: 'サマー', it: 'Estate', es: 'Verano', fr: 'Été' }, hex: '#FFD700' },
    { id: 'deep-winter', label: { en: 'Deep Winter', ja: 'ディープウィンター', it: 'Inverno Profondo', es: 'Invierno profundo', fr: 'Hiver profond' }, hex: '#00008B' },
    { id: 'soft-summer', label: { en: 'Soft Summer', ja: 'ソフトサマー', it: 'Estate Morbida', es: 'Verano suave', fr: 'Été doux' }, hex: '#B0E0E6' },
    { id: 'deep-autumn', label: { en: 'Deep Autumn', ja: 'ディープオータム', it: 'Autunno Profondo', es: 'Otoño profundo', fr: 'Automne profond' }, hex: '#8B4513' },
    { id: 'cool-winter', label: { en: 'Cool Winter', ja: 'クールウィンター', it: 'Inverno Freddo', es: 'Invierno frío', fr: 'Hiver froid' }, hex: '#4682B4' },
    { id: 'cool-summer', label: { en: 'Cool Summer', ja: 'クールサマー', it: 'Estate Fresca', es: 'Verano fresco', fr: 'Été frais' }, hex: '#87CEEB' },
    { id: 'warm-spring', label: { en: 'Warm Spring', ja: 'ウォームスプリング', it: 'Primavera Calda', es: 'Primavera cálida', fr: 'Printemps chaud' }, hex: '#FFD700' },
    { id: 'warm-autumn', label: { en: 'Warm Autumn', ja: 'ウォームオータム', it: 'Autunno Caldo', es: 'Otoño cálido', fr: 'Automne chaud' }, hex: '#CD853F' },
    { id: 'dark-autumn', label: { en: 'Dark Autumn', ja: 'ダークオータム', it: 'Autunno Scuro', es: 'Otoño oscuro', fr: 'Automne sombre' }, hex: '#8B0000' },
    { id: 'light-spring', label: { en: 'Light Spring', ja: 'ライトスプリング', it: 'Primavera Chiara', es: 'Primavera clara', fr: 'Printemps clair' }, hex: '#FFB6C1' },
    { id: 'dark-winter', label: { en: 'Dark Winter', ja: 'ダークウィンター', it: 'Inverno Scuro', es: 'Invierno oscuro', fr: 'Hiver sombre' }, hex: '#191970' },
    { id: 'light-summer', label: { en: 'Light Summer', ja: 'ライトサマー', it: 'Estate Chiara', es: 'Verano claro', fr: 'Été clair' }, hex: '#F5F5DC' },
    { id: 'bright-spring', label: { en: 'Bright Spring', ja: 'ブライトスプリング', it: 'Primavera Brillante', es: 'Primavera brillante', fr: 'Printemps éclatant' }, hex: '#FF69B4' },
    { id: 'bright-winter', label: { en: 'Bright Winter', ja: 'ブライトウィンター', it: 'Inverno Brillante', es: 'Invierno brillante', fr: 'Hiver éclatant' }, hex: '#00CED1' },
    { id: 'clear-winter', label: { en: 'Clear Winter', ja: 'クリアウィンター', it: 'Inverno Limpido', es: 'Invierno limpio', fr: 'Hiver limpide' }, hex: '#4682B4' },
    { id: 'clear-spring', label: { en: 'Clear Spring', ja: 'クリアスプリング', it: 'Primavera Limpida', es: 'Primavera limpia', fr: 'Printemps limpide' }, hex: '#FFD700' },
    { id: 'warm-summer', label: { en: 'Warm Summer', ja: 'ウォームサマー', it: 'Estate Calda', es: 'Verano cálido', fr: 'Été chaud' }, hex: '#FFA07A' },
    { id: 'soft-winter', label: { en: 'Soft Winter', ja: 'ソフトウィンター', it: 'Inverno Morbido', es: 'Invierno suave', fr: 'Hiver doux' }, hex: '#DCDCDC' },
    { id: 'cool-autumn', label: { en: 'Cool Autumn', ja: 'クールオータム', it: 'Autunno Fresco', es: 'Otoño fresco', fr: 'Automne frais' }, hex: '#8B4513' },
    { id: 'warm-fall', label: { en: 'Warm Fall', ja: 'ウォームフォール', it: 'Autunno Caldo', es: 'Otoño cálido', fr: 'Automne chaud' }, hex: '#D2691E' },
    { id: 'cold-summer', label: { en: 'Cold Summer', ja: 'コールドサマー', it: 'Estate Fredda', es: 'Verano frío', fr: 'Été froid' }, hex: '#4682B4' },
    { id: 'light-autumn', label: { en: 'Light Autumn', ja: 'ライトオータム', it: 'Autunno Chiaro', es: 'Otoño claro', fr: 'Automne clair' }, hex: '#FFD700' },
    { id: 'dark-summer', label: { en: 'Dark Summer', ja: 'ダークサマー', it: 'Estate Scura', es: 'Verano oscuro', fr: 'Été sombre' }, hex: '#8B0000' },
    { id: 'muted-autumn', label: { en: 'Muted Autumn', ja: 'ミュートオータム', it: 'Autunno Smorzato', es: 'Otoño apagado', fr: 'Automne atténué' }, hex: '#A0522D' },
    { id: 'bright-autumn', label: { en: 'Bright Autumn', ja: 'ブライトオータム', it: 'Autunno Brillante', es: 'Otoño brillante', fr: 'Automne éclatant' }, hex: '#FFA500' },
    { id: 'light-winter', label: { en: 'Light Winter', ja: 'ライトウィンター', it: 'Inverno Chiaro', es: 'Invierno claro', fr: 'Hiver clair' }, hex: '#F8F8FF' },
    { id: 'bright-summer', label: { en: 'Bright Summer', ja: 'ブライトサマー', it: 'Estate Brillante', es: 'Verano brillante', fr: 'Été éclatant' }, hex: '#FF69B4' }
  ].sort((a, b) => a.id.localeCompare(b.id));
}

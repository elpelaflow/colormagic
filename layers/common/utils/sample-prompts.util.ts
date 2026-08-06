const ja = [
  'お花見',
  '森林',
  '夕暮れ',
  'ソーダ',
  '紅葉',
  'ネオン風',
  'クリスマス',
  'ビーチ',
  'フルーツ',
  'キュート',
  'ひまわり',
  'ロマンティック',
  'エレガント',
  'お花畑',
  '水族館',
  'スポーティー',
  'ハッピー',
  '日本の着物',
  'カフェ',
  'さわやかな夏'
];

const en = [
  'Forest',
  'Ocean',
  'Beach',
  'Summer',
  'Cute',
  'Romantic',
  'Elegant',
  'Sporty',
  'Happy',
  'Spring',
  'Cafe',
  'Aquarium',
  'Sunflower',
  'Campfire',
  'Flower',
  'Winter',
  'Neon',
  'Autumn',
  'Christmas',
  'Teenage'
];

const es = [
  'Bosque',
  'Océano',
  'Playa',
  'Verano',
  'Lindo',
  'Romántico',
  'Elegante',
  'Deportivo',
  'Feliz',
  'Primavera',
  'Café',
  'Acuario',
  'Girasol',
  'Fogata',
  'Flor',
  'Invierno',
  'Neón',
  'Otoño',
  'Navidad',
  'Adolescente'
];

const fr = [
  'Forêt',
  'Océan',
  'Plage',
  'Été',
  'Mignon',
  'Romantique',
  'Élégant',
  'Sportif',
  'Joyeux',
  'Printemps',
  'Café',
  'Aquarium',
  'Tournesol',
  'Feu de camp',
  'Fleur',
  'Hiver',
  'Néon',
  'Automne',
  'Noël',
  'Adolescent'
];

export function getSamplePrompt(lang: string): string[] {
  if (lang === 'ja') {
    return ja;
  }
  if (lang === 'es') {
    return es;
  }
  if (lang === 'fr') {
    return fr;
  }
  return en;
};

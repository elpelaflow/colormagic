export default defineEventHandler(() => {
  const randomColor = Math.floor(Math.random() * 16777215).toString(16);
  const hex = `#${randomColor.padStart(6, '0')}`;

  return {
    hex,
    rgb: {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16)
    }
  };
});

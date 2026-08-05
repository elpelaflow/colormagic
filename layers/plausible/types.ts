export enum PlausibleEventName {
  COLOR_PALETTE_CREATED = 'color-palette:created',
  COLOR_PALETTE_COPIED_HEX = 'color-palette:copied:hex',
  COLOR_PALETTE_COPIED_RGB = 'color-palette:copied:rgb',

  SOCIAL_SHARE_LINK_CLICKED = 'social-share:clicked',

  RANDOM_COLOR_GENERATED = 'random-color:generated',

  COLOR_MIXER_OPENED = 'color-mixer:opened',
  COLOR_MIXER_PRESET_LOADED = 'color-mixer:preset-loaded',

  ALL_COLORS_RANDOM_COLOR_GENERATED = 'all-colors:random-color:generated',
  ALL_COLORS_COLOR_COPIED = 'all-colors:color:copied',
  ALL_COLORS_SHADE_COPIED = 'all-colors:shade:copied',
  ALL_COLORS_COLOR_PAGE_OPENED = 'all-colors:color-page:opened',
  ALL_COLORS_PANTONE_COPIED = 'all-colors:pantone:copied',
  ALL_COLORS_PANTONE_IMAGE_DOWNLOADED = 'all-colors:pantone:image-downloaded',

  COLOR_PALETTE_CREATOR_COLOR_COPIED = 'color-palette-creator:color:copied',
  COLOR_PALETTE_CREATOR_PALETTE_COPIED = 'color-palette-creator:palette:copied',
  COLOR_PALETTE_CREATOR_PNG_DOWNLOADED = 'color-palette-creator:png:downloaded',
  COLOR_PALETTE_CREATOR_ASE_DOWNLOADED = 'color-palette-creator:ase:downloaded',
  COLOR_PALETTE_CREATOR_PDF_EXPORTED = 'color-palette-creator:pdf:exported',

  GITHUB_BUTTON_FLOATING_CLICKED = 'github-button:floating:clicked',

  FEEDBACK_SUBMITTED = 'feedback:submitted',
}

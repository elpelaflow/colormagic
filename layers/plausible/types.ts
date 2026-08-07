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

  GRADIENT_GENERATOR_STOP_ADDED = 'gradient-generator:stop-added',
  GRADIENT_GENERATOR_COPY_CSS = 'gradient-generator:copied:css',
  GRADIENT_GENERATOR_SAVED = 'gradient-generator:saved',
  GRADIENT_GENERATOR_CSS_DOWNLOADED = 'gradient-generator:css:downloaded',
  GRADIENT_GENERATOR_TAILWIND_DOWNLOADED = 'gradient-generator:tailwind:downloaded',
  GRADIENT_GENERATOR_JSON_DOWNLOADED = 'gradient-generator:json:downloaded',

  GITHUB_BUTTON_FLOATING_CLICKED = 'github-button:floating:clicked',

  FEEDBACK_SUBMITTED = 'feedback:submitted',

  FAVORITE_ADDED = 'favorite:added',
  FAVORITE_REMOVED = 'favorite:removed',

  TOKEN_EXTRACTOR_EXTRACTED = 'token-extractor:extracted',
  TOKEN_EXTRACTOR_EXAMPLE_SELECTED = 'token-extractor:example:selected',
  TOKEN_EXTRACTOR_RUNTIME_RUN = 'token-extractor:runtime:run',
  TOKEN_EXTRACTOR_TOKEN_COPIED = 'token-extractor:token:copied',
  TOKEN_EXTRACTOR_CSS_COPIED = 'token-extractor:copied:css',
  TOKEN_EXTRACTOR_TAILWIND_COPIED = 'token-extractor:copied:tailwind',
  TOKEN_EXTRACTOR_JSON_DOWNLOADED = 'token-extractor:downloaded:json',
  TOKEN_EXTRACTOR_TAILWIND_DOWNLOADED = 'token-extractor:downloaded:tailwind',

  SKIN_TONE_COPIED = 'skin-tone:copied',
  SKIN_TONE_COPY_ALL = 'skin-tone:copied:all',
  SKIN_TONE_COLOR_PAGE_OPENED = 'skin-tone:color-page:opened',

  PALETTE_MAKER_GENERATED = 'palette-maker:generated',
  PALETTE_MAKER_STOP_ADDED = 'palette-maker:stop-added',
  PALETTE_MAKER_COLOR_COPIED = 'palette-maker:color:copied',
  PALETTE_MAKER_COLOR_SAVED = 'palette-maker:color:saved',
  PALETTE_MAKER_COLOR_UNSAVED = 'palette-maker:color:unsaved',
  PALETTE_MAKER_COLUMN_REMOVED = 'palette-maker:column:removed',
  PALETTE_MAKER_COLOR_PAGE_OPENED = 'palette-maker:color-page:opened',
  PALETTE_MAKER_HARMONY_TOGGLED = 'palette-maker:harmony:toggled',
}

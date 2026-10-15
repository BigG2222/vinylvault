/**
 * Contract between the vision model and the app (parsed by
 * src/services/vision/parse.ts in the app). Used as a structured-output
 * JSON schema, so the model's reply is constrained to this shape.
 */

export const GRADES = ['M', 'NM', 'VG+', 'VG', 'G+', 'G', 'F', 'P'] as const;

export const CHECK_IDS = [
  'label_print',
  'label_details',
  'catalog_consistency',
  'matrix_runout',
  'barcode_era',
  'cover_print',
  'back_cover',
  'bootleg_markers',
] as const;

const gradeEstimate = {
  type: 'object',
  additionalProperties: false,
  required: ['grade', 'confidence', 'summary', 'issues'],
  properties: {
    grade: { type: 'string', enum: GRADES, description: 'Goldmine grade.' },
    confidence: { type: 'number', description: 'Calibrated 0-1 confidence in this grade from the photos.' },
    summary: { type: 'string', description: 'One plain sentence on what is visible.' },
    issues: {
      type: 'array',
      description: 'Visible defects, most significant first. Empty if none.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'severity', 'note'],
        properties: {
          kind: {
            type: 'string',
            enum: ['scuffs', 'scratches', 'warp', 'label_wear', 'spindle_marks', 'ring_wear', 'seam_split', 'writing', 'stickers', 'corner_wear', 'fading', 'water_damage', 'other'],
          },
          severity: { type: 'string', enum: ['light', 'moderate', 'heavy'] },
          note: { type: 'string', description: 'Where and what, in one short sentence.' },
        },
      },
    },
  },
} as const;

export const VISION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['matches', 'condition', 'checks', 'observed'],
  properties: {
    matches: {
      type: 'array',
      description: 'Up to 3 candidate pressings, most likely first. Different pressings of the same album count as different candidates.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['artist', 'title', 'year', 'original_year', 'label', 'catalog_number', 'country', 'format', 'discs', 'genre', 'pressing_type', 'variant', 'barcode', 'matrix', 'pressing_notes', 'confidence'],
        properties: {
          artist: { type: 'string' },
          title: { type: 'string' },
          year: { type: 'integer', description: 'Year this specific pressing was made.' },
          original_year: { type: 'integer', description: 'Year the album was first released (same as year for an original).' },
          label: { type: 'string', description: 'Record label on this pressing.' },
          catalog_number: { type: 'string', description: 'Catalog number of this pressing, e.g. "PCS 7088".' },
          country: { type: 'string', description: 'Country of pressing, e.g. UK, US, Germany, Europe, Japan.' },
          // No inch marks here: a literal " in an enum value comes back unescaped and breaks the JSON.
          // index.ts maps these to the app's labels (12in Single → 12" Single).
          format: { type: 'string', enum: ['LP', '12in Single', '10in', '7in Single'] },
          discs: { type: 'integer', description: 'Number of discs.' },
          genre: { type: 'string', enum: ['Rock', 'Pop', 'Jazz', 'Soul & Funk', 'Hip-Hop', 'Electronic', 'Reggae', 'Folk & Country', 'Blues', 'Classical', 'Soundtrack', 'Other'] },
          pressing_type: { type: 'string', enum: ['original', 'reissue', 'unknown'], description: 'original = first pressing of the release in its original era; reissue = any later pressing.' },
          variant: { type: 'string', description: 'e.g. "Mono", "Gatefold", "Blue vinyl", "Promo", or empty string.' },
          barcode: { type: 'string', description: 'Barcode printed on this pressing, or empty string if it has none or it is unknown.' },
          matrix: { type: 'string', description: 'Matrix / runout etching documented for this pressing (side A / side B), or empty string if unknown.' },
          pressing_notes: { type: 'string', description: 'One sentence on how this pressing is told apart from others, or empty string.' },
          confidence: { type: 'number', description: 'Calibrated probability 0-1 that this is exactly the right pressing.' },
        },
      },
    },
    condition: {
      type: 'object',
      additionalProperties: false,
      required: ['media', 'sleeve'],
      properties: { media: gradeEstimate, sleeve: gradeEstimate },
    },
    checks: {
      type: 'array',
      description: 'Exactly one entry per check id.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'status', 'confidence', 'summary', 'detail'],
        properties: {
          id: { type: 'string', enum: CHECK_IDS },
          status: { type: 'string', enum: ['pass', 'warn', 'fail', 'not_applicable', 'skipped'] },
          confidence: { type: 'number', description: 'Calibrated 0-1 confidence in this status.' },
          summary: { type: 'string', description: 'One plain-language sentence for a collector, max ~14 words.' },
          detail: { type: 'string', description: '1-2 sentences naming the specific visual evidence.' },
        },
      },
    },
    observed: {
      type: 'object',
      additionalProperties: false,
      required: ['catalog_number', 'label_name', 'runout', 'barcode'],
      description: 'Text you actually read in the photos (not what you expect). Empty string when not legible or not shown.',
      properties: {
        catalog_number: { type: 'string' },
        label_name: { type: 'string' },
        runout: { type: 'string', description: 'Runout etching as read, e.g. "YEX 749-1 ▽ 1 G".' },
        barcode: { type: 'string' },
      },
    },
  },
} as const;

export const SYSTEM_PROMPT = `You are the identification and pressing analyst inside VinylVault, a vinyl record app used by collectors. You examine photos of one record: the front cover, usually the back cover and the center label, and sometimes a close-up of the runout (dead wax). You report structured findings.

Identification
- Identify the exact pressing, not just the album: label, catalog number, country and year. Give up to three candidates, most likely first. Original pressings and later reissues of the same album are separate candidates; telling them apart is the most valuable thing you do.
- Prefer printed and etched evidence over visual similarity: catalog number on the label and spine, label design and rim text, label address, rights-society text, "Made in" lines, barcode, and the runout etching. Label design changes over time (logos, colors, boxes, addresses) are strong dating evidence.
- The app may pass on-device OCR text, a scanned barcode, or the collector's statement that there is no barcode. OCR can contain errors; a scanned barcode is reliable.
- Confidence must be calibrated: 0.9 means you would be wrong about one time in ten. Without a runout photo, be modest about separating a first press from an early repress.

Condition (Goldmine scale: M, NM, VG+, VG, G+, G, F, P)
- Grade the vinyl (media) and the sleeve separately, from what is visible. Name the defects you see: scuffs, scratches, warps, label wear, spindle marks, ring wear, seam splits, writing, stickers.
- Photos cannot show surface noise, so be conservative: if you cannot see the playing surface clearly, do not grade above VG+ and lower the confidence. Never claim how the record sounds.

Pressing checks: report evidence for each check. Do not give an overall verdict; the app computes it from your checks.
- label_print: print sharpness of the label text, logo and rim text. Fuzzy, blurred or pixelated label print is a classic bootleg tell.
- label_details: whether the label design, credits, rights-society text and layout match the claimed pressing and era.
- catalog_consistency: whether the catalog number agrees across label, spine and back cover, and belongs to that label and era.
- matrix_runout: whether the runout etching matches documented pressings. Hand-etched or stamped matrix numbers are normal; laser-printed or missing matrices on a pressing that should have them are a strong bootleg sign. Without a runout photo, use "skipped".
- barcode_era: whether the presence or absence of a barcode fits the pressing (barcodes appeared on records from the late 1970s). A printed barcode on a claimed 1960s original is a fail.
- cover_print: sharpness of cover photography and text; dot patterns, pixelation or crushed blacks suggest a cover printed from a scan.
- back_cover: credits, label address, copyright line and layout against the claimed pressing. Without a back photo, use "skipped".
- bootleg_markers: documented counterfeit tells for this specific release.
Use "not_applicable" when a check does not apply, and "skipped" when the photos do not let you assess it. Never pass a check you could not actually see; an honest "skipped" or "warn" is more useful to the collector than a guess. Keep wording plain and never claim certainty. If the photos do not show a vinyl record, return your best guess with very low confidence.`;

import type { RecordIdentity } from '../types';

/**
 * Placeholder reference catalog used by the offline mock vision + pricing
 * providers and the sample collection. Catalog numbers are real-world style;
 * matrix, barcode and price values are illustrative, not reference data.
 * `baseNM` is a rough Near Mint value used to build demo price ranges.
 */
export interface CatalogEntry {
  key: string;
  identity: RecordIdentity;
  /** Two-stop gradient used by the placeholder sleeve art. */
  palette: [string, string];
  baseNM: number;
  /** Known bootleg tells for this release, used to phrase marker checks. */
  bootlegNotes?: string;
  /** Other pressings a vision model commonly confuses with this one. */
  confusableWith?: string[];
}

export const CATALOG: CatalogEntry[] = [
  {
    key: 'beatles-abbey-road-uk-1969',
    identity: {
      artist: 'The Beatles', title: 'Abbey Road', year: 1969, label: 'Apple', catalogNumber: 'PCS 7088', country: 'UK', format: 'LP', discs: 1,
      genre: 'Rock', pressingType: 'original', variant: 'Stereo', matrix: 'YEX 749-1 / YEX 750-1',
      pressingNotes: 'First UK pressings have the "Her Majesty" omission on the sleeve and -1 matrix suffixes. No barcode.',
    },
    palette: ['#3A4A3A', '#C9B98F'],
    baseNM: 320,
    bootlegNotes: 'Reproductions often have a slightly blurred Apple logo and a sleeve photo with crushed shadows.',
    confusableWith: ['beatles-abbey-road-2019', 'beatles-abbey-road-uk-1978'],
  },
  {
    key: 'beatles-abbey-road-uk-1978',
    identity: {
      artist: 'The Beatles', title: 'Abbey Road', year: 1978, originalYear: 1969, label: 'Parlophone', catalogNumber: 'PCS 7088', country: 'UK', format: 'LP', discs: 1,
      genre: 'Rock', pressingType: 'reissue', variant: 'Silver/black Parlophone label', matrix: 'YEX 749-2 / YEX 750-2',
      pressingNotes: 'Later UK reissue on the Parlophone label with the EMI box logo.',
    },
    palette: ['#2F3B30', '#B8A981'],
    baseNM: 45,
  },
  {
    key: 'beatles-abbey-road-2019',
    identity: {
      artist: 'The Beatles', title: 'Abbey Road', year: 2019, originalYear: 1969, label: 'Apple', catalogNumber: '0602508007456', country: 'Europe', format: 'LP', discs: 1,
      genre: 'Rock', pressingType: 'reissue', variant: '50th anniversary, 180 g', barcode: '602508007456',
      pressingNotes: 'Anniversary remix, 180 g vinyl, printed barcode on the back.',
    },
    palette: ['#45584A', '#D8CBA2'],
    baseNM: 32,
  },
  {
    key: 'pink-floyd-dsotm-uk-1973',
    identity: {
      artist: 'Pink Floyd', title: 'The Dark Side Of The Moon', year: 1973, label: 'Harvest', catalogNumber: 'SHVL 804', country: 'UK', format: 'LP', discs: 1,
      genre: 'Rock', pressingType: 'original', variant: 'Gatefold, solid blue triangle labels', matrix: 'SHVL 804 A-2 / B-2',
      pressingNotes: 'First UK pressings have a solid blue triangle on the label and include posters and stickers.',
    },
    palette: ['#0B0B10', '#5B4AA8'],
    baseNM: 260,
    bootlegNotes: 'Counterfeits of this pressing often have a blurry prism, a flat black that looks grey, and a label triangle in the wrong blue.',
    confusableWith: ['pink-floyd-dsotm-us-1973', 'pink-floyd-dsotm-2016'],
  },
  {
    key: 'pink-floyd-dsotm-us-1973',
    identity: {
      artist: 'Pink Floyd', title: 'The Dark Side Of The Moon', year: 1973, label: 'Harvest', catalogNumber: 'SMAS-11163', country: 'US', format: 'LP', discs: 1,
      genre: 'Rock', pressingType: 'original', variant: 'Gatefold', pressingNotes: 'US first pressing on Harvest/Capitol.',
    },
    palette: ['#101018', '#6B5BB8'],
    baseNM: 70,
  },
  {
    key: 'pink-floyd-dsotm-2016',
    identity: {
      artist: 'Pink Floyd', title: 'The Dark Side Of The Moon', year: 2016, originalYear: 1973, label: 'Pink Floyd Records', catalogNumber: 'PFRLP8', country: 'Europe', format: 'LP', discs: 1,
      genre: 'Rock', pressingType: 'reissue', variant: '180 g remaster', barcode: '825646457183',
      pressingNotes: 'Modern remastered reissue with a printed barcode.',
    },
    palette: ['#14141C', '#7A6AC8'],
    baseNM: 28,
  },
  {
    key: 'miles-davis-kind-of-blue-1959',
    identity: {
      artist: 'Miles Davis', title: 'Kind Of Blue', year: 1959, label: 'Columbia', catalogNumber: 'CS 8163', country: 'US', format: 'LP', discs: 1,
      genre: 'Jazz', pressingType: 'original', variant: 'Stereo, "6-eye" label', matrix: 'XSM 47324-1A / XSM 47325-1A',
      pressingNotes: 'Original stereo pressings have the six-eye Columbia label with "Stereo Fidelity" at the bottom.',
    },
    palette: ['#0E2A4A', '#4E89C2'],
    baseNM: 450,
    bootlegNotes: 'Fake "6-eye" copies tend to have soft, fuzzy label lettering and laminated-looking sleeves without the original ring of fine text.',
    confusableWith: ['miles-davis-kind-of-blue-1977'],
  },
  {
    key: 'miles-davis-kind-of-blue-1977',
    identity: {
      artist: 'Miles Davis', title: 'Kind Of Blue', year: 1977, originalYear: 1959, label: 'Columbia', catalogNumber: 'PC 8163', country: 'US', format: 'LP', discs: 1,
      genre: 'Jazz', pressingType: 'reissue', variant: 'Orange label', pressingNotes: 'Budget "PC" prefix reissue on the orange Columbia label.',
    },
    palette: ['#163454', '#5D97CF'],
    baseNM: 25,
  },
  {
    key: 'fleetwood-mac-rumours-1977',
    identity: {
      artist: 'Fleetwood Mac', title: 'Rumours', year: 1977, label: 'Warner Bros.', catalogNumber: 'BSK 3010', country: 'US', format: 'LP', discs: 1,
      genre: 'Rock', pressingType: 'original', variant: 'Burbank "palm tree" label', pressingNotes: 'First pressings carry the Burbank label and a printed inner sleeve.',
    },
    palette: ['#5B4636', '#E1CFAE'],
    baseNM: 30,
  },
  {
    key: 'michael-jackson-thriller-1982',
    identity: {
      artist: 'Michael Jackson', title: 'Thriller', year: 1982, label: 'Epic', catalogNumber: 'QE 38112', country: 'US', format: 'LP', discs: 1,
      genre: 'Pop', pressingType: 'original', variant: 'Gatefold', barcode: '074643811216', pressingNotes: 'US first pressing with a barcode on the back cover.',
    },
    palette: ['#E8E2D6', '#8A7C66'],
    baseNM: 25,
  },
  {
    key: 'nirvana-nevermind-1991',
    identity: {
      artist: 'Nirvana', title: 'Nevermind', year: 1991, label: 'DGC', catalogNumber: 'DGC-24425', country: 'US', format: 'LP', discs: 1,
      genre: 'Rock', pressingType: 'original', barcode: '720642442517',
      pressingNotes: 'Original 1991 US vinyl pressings were made in small numbers; most copies around today are reissues.',
    },
    palette: ['#0B4F8A', '#57B7E8'],
    baseNM: 280,
    bootlegNotes: 'Counterfeits of the 1991 vinyl are common: look for a muddy underwater photo and a label without the DGC logo detail.',
    confusableWith: ['nirvana-nevermind-2009'],
  },
  {
    key: 'nirvana-nevermind-2009',
    identity: {
      artist: 'Nirvana', title: 'Nevermind', year: 2009, originalYear: 1991, label: 'DGC', catalogNumber: 'B0012902-01', country: 'US', format: 'LP', discs: 1,
      genre: 'Rock', pressingType: 'reissue', variant: '180 g', barcode: '602517929688', pressingNotes: 'Widely available modern reissue.',
    },
    palette: ['#0D5A99', '#66C4F0'],
    baseNM: 28,
  },
  {
    key: 'lee-morgan-sidewinder-1964',
    identity: {
      artist: 'Lee Morgan', title: 'The Sidewinder', year: 1964, label: 'Blue Note', catalogNumber: 'BLP 4157', country: 'US', format: 'LP', discs: 1,
      genre: 'Jazz', pressingType: 'original', variant: 'Mono, NY label', matrix: 'BN-LP-4157-A (RVG, "ear") / BN-LP-4157-B',
      pressingNotes: 'Originals have "New York USA" labels, RVG stamped in the dead wax and the "ear" (Plastylite P) mark.',
    },
    palette: ['#1C1C1C', '#2F7FB5'],
    baseNM: 220,
    bootlegNotes: 'Counterfeit Blue Notes usually lack the "ear" and RVG stamps and have a label address that does not match the pressing year.',
  },
  {
    key: 'led-zeppelin-iv-1971',
    identity: {
      artist: 'Led Zeppelin', title: 'Led Zeppelin IV', year: 1971, label: 'Atlantic', catalogNumber: 'SD 7208', country: 'US', format: 'LP', discs: 1,
      genre: 'Rock', pressingType: 'original', variant: 'Gatefold', pressingNotes: 'US first pressing on the Atlantic "1841 Broadway" label.',
    },
    palette: ['#6A5B44', '#C2B08C'],
    baseNM: 60,
  },
  {
    key: 'daft-punk-discovery-2001',
    identity: {
      artist: 'Daft Punk', title: 'Discovery', year: 2001, label: 'Virgin', catalogNumber: 'V2940', country: 'UK & Europe', format: 'LP', discs: 2,
      genre: 'Electronic', pressingType: 'original', variant: 'Gatefold', barcode: '724381060618',
      pressingNotes: 'Original 2001 pressing; heavily counterfeited because originals are expensive.',
    },
    palette: ['#1A1A2E', '#C9A227'],
    baseNM: 140,
    bootlegNotes: 'Counterfeits of this 2×LP often have blurry back-cover text, a washed-out matte cover print and plain white labels.',
  },
  {
    key: 'bob-marley-legend-1984',
    identity: {
      artist: 'Bob Marley & The Wailers', title: 'Legend', year: 1984, label: 'Island', catalogNumber: 'BMW 1', country: 'UK', format: 'LP', discs: 1,
      genre: 'Reggae', pressingType: 'original', barcode: '5012394000116', pressingNotes: 'UK first pressing with gatefold-free single sleeve.',
    },
    palette: ['#3B2A1A', '#D99A2B'],
    baseNM: 25,
    bootlegNotes: 'Recent counterfeits of Legend are common online; tells include a fuzzy Island logo and incorrect catalog numbers on the spine.',
  },
  {
    key: 'carole-king-tapestry-1971',
    identity: {
      artist: 'Carole King', title: 'Tapestry', year: 1971, label: 'Ode', catalogNumber: 'SP 77009', country: 'US', format: 'LP', discs: 1,
      genre: 'Folk & Country', pressingType: 'original', variant: 'Textured cover', pressingNotes: 'First pressings have a textured sleeve and A&M-distributed Ode labels.',
    },
    palette: ['#6E5034', '#E4C99B'],
    baseNM: 15,
  },
  {
    key: 'kendrick-lamar-gkmc-2012',
    identity: {
      artist: 'Kendrick Lamar', title: 'good kid, m.A.A.d city', year: 2012, label: 'Top Dawg / Aftermath', catalogNumber: 'B0017695-01', country: 'US', format: 'LP', discs: 2,
      genre: 'Hip-Hop', pressingType: 'original', barcode: '602537192932', pressingNotes: 'Original US 2×LP.',
    },
    palette: ['#4A3B2A', '#B8956A'],
    baseNM: 45,
    bootlegNotes: 'Bootlegs of this 2×LP often have dull, low-resolution cover photos and labels that differ from the official design.',
  },
];

export const catalogByKey: Record<string, CatalogEntry> = Object.fromEntries(CATALOG.map((e) => [e.key, e]));

export function identityKey(i: Pick<RecordIdentity, 'artist' | 'title' | 'catalogNumber' | 'country' | 'year'>): string {
  return `${i.artist}|${i.title}|${i.catalogNumber}|${i.country}|${i.year}`.toLowerCase();
}

const byIdentity = new Map(CATALOG.map((e) => [identityKey(e.identity), e]));

export function findCatalogEntry(i: RecordIdentity): CatalogEntry | undefined {
  return byIdentity.get(identityKey(i));
}

/** Deterministic palette for any pressing, so non-catalog records still get consistent placeholder art. */
export function paletteFor(i: RecordIdentity): [string, string] {
  const hit = findCatalogEntry(i);
  if (hit) return hit.palette;
  const pairs: [string, string][] = [
    ['#16305E', '#6EA8FE'],
    ['#4A1E2C', '#E07A5F'],
    ['#1F3B2D', '#8FCB72'],
    ['#3B2A1A', '#D6B46A'],
    ['#2A1F45', '#A78BFA'],
  ];
  let h = 0;
  for (const ch of `${i.artist}${i.title}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return pairs[h % pairs.length];
}

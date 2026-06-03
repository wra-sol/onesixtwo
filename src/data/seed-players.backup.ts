/**
 * Archived manual player seeds with hand-entered stats.
 * Used only when Lahman data is unavailable (`npm run fetch:lahman`).
 * Active curation lives in seed-players.ts as SEED_HINTS.
 */
import type {
  Era,
  LineupPosition,
  Player,
  PlayerRatings,
  TeamId,
} from '../lib/types'

function hitterRatings(
  contact: number,
  power: number,
  speed: number,
  runProduction: number,
  ops: number,
): PlayerRatings {
  const overall = Math.round(
    ops * 0.35 +
      power * 0.25 +
      contact * 0.2 +
      speed * 0.1 +
      runProduction * 0.1,
  )
  return {
    contact,
    power,
    speed,
    runProduction,
    ops,
    era: 0,
    whip: 0,
    strikeouts: 0,
    wins: 0,
    workload: 0,
    overall,
  }
}

function pitcherRatings(
  era: number,
  whip: number,
  strikeouts: number,
  wins: number,
  workload: number,
): PlayerRatings {
  const overall = Math.round(
    era * 0.35 +
      whip * 0.25 +
      strikeouts * 0.2 +
      wins * 0.1 +
      workload * 0.1,
  )
  return {
    contact: 0,
    power: 0,
    speed: 0,
    runProduction: 0,
    ops: 0,
    era,
    whip,
    strikeouts,
    wins,
    workload,
    overall,
  }
}

function personIdFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function estimateHitterGames(hr: number, rbi: number, sb: number): number {
  return Math.max(162, Math.round(hr * 6 + rbi * 0.12 + sb * 2 + 450))
}

function estimatePitcherStarts(wins: number, so: number): number {
  return Math.max(30, Math.round(wins * 1.6 + so / 90))
}

function h(
  id: string,
  name: string,
  teamId: TeamId,
  teamName: string,
  era: Era,
  positions: LineupPosition[],
  avg: string,
  hr: number,
  rbi: number,
  sb: number,
  ops: string,
  ratings: ReturnType<typeof hitterRatings>,
  g?: number,
): Player {
  return {
    id,
    personId: personIdFromName(name),
    name,
    teamId,
    teamName,
    era,
    role: 'hitter',
    positions,
    stats: {
      avg,
      hr,
      rbi,
      sb,
      ops,
      g: g ?? estimateHitterGames(hr, rbi, sb),
    },
    ratings,
  }
}

function p(
  id: string,
  name: string,
  teamId: TeamId,
  teamName: string,
  era: Era,
  positions: LineupPosition[],
  eraStat: string,
  whip: string,
  so: number,
  wins: number,
  ratings: ReturnType<typeof pitcherRatings>,
  gs?: number,
): Player {
  return {
    id,
    personId: personIdFromName(name),
    name,
    teamId,
    teamName,
    era,
    role: 'pitcher',
    positions,
    stats: {
      era: eraStat,
      whip,
      so,
      wins,
      gs: gs ?? estimatePitcherStarts(wins, so),
    },
    ratings,
  }
}

export const SEED_PLAYERS_BACKUP: Player[] = [
  h('ruth-27', 'Babe Ruth', 'yankees', 'Yankees', '1920s', ['RF'], '.356', 60, 165, 8, '1.181', hitterRatings(88, 99, 55, 98, 99)),
  p('ruth-p', 'Babe Ruth', 'red-sox', 'Red Sox', '1910s', ['P'], '2.19', '1.05', 133, 89, pitcherRatings(92, 90, 85, 88, 82)),
  h('gehrig-27', 'Lou Gehrig', 'yankees', 'Yankees', '1930s', ['1B'], '.340', 49, 150, 5, '1.080', hitterRatings(90, 95, 50, 96, 97)),
  h('dimaggio-39', 'Joe DiMaggio', 'yankees', 'Yankees', '1940s', ['CF'], '.325', 30, 125, 5, '.967', hitterRatings(88, 82, 70, 85, 90)),
  h('mantle-56', 'Mickey Mantle', 'yankees', 'Yankees', '1950s', ['CF'], '.298', 52, 130, 10, '1.042', hitterRatings(85, 96, 88, 92, 96)),
  p('ford-61', 'Whitey Ford', 'yankees', 'Yankees', '1960s', ['P'], '2.75', '1.22', 1569, 236, pitcherRatings(90, 88, 82, 90, 85)),
  h('jeter-99', 'Derek Jeter', 'yankees', 'Yankees', '1990s', ['SS'], '.310', 260, 1311, 358, '.817', hitterRatings(88, 78, 82, 85, 84)),
  h('judge-22', 'Aaron Judge', 'yankees', 'Yankees', '2020s', ['RF'], '.285', 62, 152, 12, '1.049', hitterRatings(82, 98, 65, 90, 95)),
  p('rivera-03', 'Mariano Rivera', 'yankees', 'Yankees', '1990s', ['P'], '2.21', '1.00', 1173, 82, pitcherRatings(96, 98, 88, 75, 80)),

  h('williams-46', 'Ted Williams', 'red-sox', 'Red Sox', '1940s', ['LF'], '.344', 38, 130, 2, '1.116', hitterRatings(95, 92, 55, 94, 98)),
  h('yaz-67', 'Carl Yastrzemski', 'red-sox', 'Red Sox', '1960s', ['LF'], '.285', 452, 1844, 168, '.841', hitterRatings(82, 88, 70, 90, 85)),
  h('boggs-86', 'Wade Boggs', 'red-sox', 'Red Sox', '1980s', ['3B'], '.328', 118, 1014, 38, '.858', hitterRatings(95, 70, 55, 82, 86)),
  p('martinez-04', 'Pedro Martinez', 'red-sox', 'Red Sox', '1990s', ['P'], '2.52', '1.05', 2194, 117, pitcherRatings(94, 95, 95, 82, 88)),
  h('ortiz-16', 'David Ortiz', 'red-sox', 'Red Sox', '2000s', ['1B'], '.286', 541, 1768, 17, '.991', hitterRatings(80, 96, 40, 95, 94)),
  h('betts-24', 'Mookie Betts', 'red-sox', 'Red Sox', '2010s', ['RF', 'CF'], '.295', 32, 120, 18, '.928', hitterRatings(88, 82, 90, 85, 90)),

  h('robinson-55', 'Jackie Robinson', 'dodgers', 'Dodgers', '1950s', ['2B'], '.311', 137, 734, 197, '.883', hitterRatings(88, 78, 92, 82, 88)),
  h('snider-55', 'Duke Snider', 'dodgers', 'Dodgers', '1950s', ['CF'], '.295', 407, 1333, 99, '.919', hitterRatings(82, 90, 75, 90, 90)),
  p('koufax-66', 'Sandy Koufax', 'dodgers', 'Dodgers', '1960s', ['P'], '2.76', '1.11', 2396, 165, pitcherRatings(91, 92, 94, 85, 82)),
  h('garvey-78', 'Steve Garvey', 'dodgers', 'Dodgers', '1970s', ['1B'], '.294', 272, 1308, 83, '.799', hitterRatings(85, 80, 60, 82, 80)),
  h('gwynn-99', 'Tony Gwynn', 'padres', 'Padres', '1990s', ['RF'], '.338', 135, 1138, 319, '.847', hitterRatings(98, 72, 75, 85, 88)),
  p('kershaw-14', 'Clayton Kershaw', 'dodgers', 'Dodgers', '2010s', ['P'], '2.48', '1.02', 2100, 210, pitcherRatings(93, 94, 90, 88, 86)),

  h('mays-65', 'Willie Mays', 'giants', 'Giants', '1960s', ['CF'], '.302', 660, 1903, 338, '.941', hitterRatings(88, 95, 95, 96, 96)),
  h('bonds-04', 'Barry Bonds', 'giants', 'Giants', '2000s', ['LF'], '.298', 762, 1996, 514, '1.051', hitterRatings(85, 99, 88, 98, 99)),
  h('mccovey-70', 'Willie McCovey', 'giants', 'Giants', '1960s', ['1B'], '.270', 521, 1555, 26, '.889', hitterRatings(75, 96, 45, 92, 90)),
  p('marichal-69', 'Juan Marichal', 'giants', 'Giants', '1960s', ['P'], '2.89', '1.18', 2303, 243, pitcherRatings(88, 86, 88, 88, 85)),

  h('musial-63', 'Stan Musial', 'cardinals', 'Cardinals', '1950s', ['LF', '1B'], '.331', 475, 1951, 78, '.976', hitterRatings(92, 90, 70, 94, 95)),
  p('gibson-68', 'Bob Gibson', 'cardinals', 'Cardinals', '1960s', ['P'], '2.91', '1.19', 3117, 251, pitcherRatings(88, 85, 92, 88, 90)),
  h('ozzie-99', 'Ozzie Smith', 'cardinals', 'Cardinals', '1980s', ['SS'], '.262', 28, 793, 580, '.666', hitterRatings(70, 55, 85, 65, 68)),
  h('pujols-11', 'Albert Pujols', 'cardinals', 'Cardinals', '2000s', ['1B'], '.308', 703, 2218, 114, '.991', hitterRatings(90, 95, 55, 96, 96)),

  h('banks-70', 'Ernie Banks', 'cubs', 'Cubs', '1960s', ['SS', '1B'], '.274', 512, 1636, 50, '.830', hitterRatings(78, 92, 60, 90, 85)),
  h('sandberg-91', 'Ryne Sandberg', 'cubs', 'Cubs', '1980s', ['2B'], '.285', 277, 1061, 344, '.814', hitterRatings(82, 82, 82, 82, 82)),
  h('sosa-02', 'Sammy Sosa', 'cubs', 'Cubs', '1990s', ['RF'], '.273', 609, 1667, 234, '.878', hitterRatings(75, 96, 80, 90, 88)),
  p('brown-98', 'Mordecai Brown', 'cubs', 'Cubs', '1920s', ['P'], '2.06', '1.04', 1372, 239, pitcherRatings(95, 92, 80, 88, 78)),

  h('aaron-74', 'Hank Aaron', 'braves', 'Braves', '1970s', ['RF'], '.305', 755, 2297, 240, '.928', hitterRatings(88, 98, 75, 96, 95)),
  h('mathews-68', 'Eddie Mathews', 'braves', 'Braves', '1960s', ['3B'], '.271', 512, 1453, 68, '.885', hitterRatings(78, 94, 60, 88, 88)),
  h('jones-13', 'Chipper Jones', 'braves', 'Braves', '1990s', ['3B'], '.303', 468, 1613, 150, '.930', hitterRatings(88, 90, 70, 90, 92)),
  p('smoltz-99', 'John Smoltz', 'braves', 'Braves', '1990s', ['P'], '3.33', '1.22', 3084, 213, pitcherRatings(82, 84, 90, 85, 85)),

  p('seaver-75', 'Tom Seaver', 'mets', 'Mets', '1970s', ['P'], '2.86', '1.12', 3640, 311, pitcherRatings(90, 90, 95, 92, 90)),
  h('strawberry-90', 'Darryl Strawberry', 'mets', 'Mets', '1980s', ['RF'], '.255', 335, 1000, 221, '.856', hitterRatings(72, 92, 78, 85, 85)),
  h('piazza-99', 'Mike Piazza', 'mets', 'Mets', '1990s', ['C'], '.308', 427, 1335, 20, '.922', hitterRatings(85, 92, 40, 90, 92)),
  p('degarom-22', 'Jacob deGrom', 'mets', 'Mets', '2010s', ['P'], '2.52', '0.99', 1600, 87, pitcherRatings(94, 96, 92, 78, 80)),

  h('schmidt-89', 'Mike Schmidt', 'phillies', 'Phillies', '1980s', ['3B'], '.267', 548, 1595, 174, '.885', hitterRatings(75, 96, 65, 90, 90)),
  p('carlton-84', 'Steve Carlton', 'phillies', 'Phillies', '1980s', ['P'], '3.22', '1.25', 4136, 329, pitcherRatings(85, 80, 95, 90, 92)),
  h('howard-11', 'Ryan Howard', 'phillies', 'Phillies', '2000s', ['1B'], '.258', 382, 1194, 15, '.859', hitterRatings(70, 94, 45, 88, 85)),

  h('bench-77', 'Johnny Bench', 'reds', 'Reds', '1970s', ['C'], '.267', 389, 1376, 68, '.830', hitterRatings(78, 90, 55, 88, 85)),
  h('morgan-77', 'Joe Morgan', 'reds', 'Reds', '1970s', ['2B'], '.271', 268, 1133, 689, '.819', hitterRatings(80, 82, 92, 85, 86)),
  h('rose-85', 'Pete Rose', 'reds', 'Reds', '1970s', ['1B', '2B', 'LF'], '.303', 160, 1314, 198, '.784', hitterRatings(90, 70, 80, 82, 78)),
  p('nolan-75', 'Nolan Ryan', 'astros', 'Astros', '1980s', ['P'], '3.19', '1.25', 5714, 324, pitcherRatings(84, 80, 99, 88, 92)),

  h('kaline-75', 'Al Kaline', 'tigers', 'Tigers', '1960s', ['RF'], '.297', 399, 1583, 137, '.827', hitterRatings(88, 88, 75, 88, 85)),
  h('trammell-96', 'Alan Trammell', 'tigers', 'Tigers', '1980s', ['SS'], '.285', 185, 1003, 143, '.767', hitterRatings(82, 78, 72, 78, 78)),
  p('verlander-19', 'Justin Verlander', 'tigers', 'Tigers', '2010s', ['P'], '3.24', '1.19', 3100, 257, pitcherRatings(84, 86, 90, 88, 88)),

  h('clemente-72', 'Roberto Clemente', 'pirates', 'Pirates', '1960s', ['RF'], '.317', 240, 1305, 83, '.834', hitterRatings(90, 82, 88, 85, 86)),
  h('stargell-79', 'Willie Stargell', 'pirates', 'Pirates', '1970s', ['LF'], '.282', 475, 1540, 20, '.889', hitterRatings(78, 94, 45, 90, 88)),
  h('bonds-pit', 'Barry Bonds', 'pirates', 'Pirates', '1990s', ['LF'], '.298', 762, 1996, 514, '1.051', hitterRatings(85, 99, 88, 98, 99)),

  h('henderson-89', 'Rickey Henderson', 'athletics', "Athletics", '1980s', ['LF'], '.279', 297, 1115, 1406, '.822', hitterRatings(78, 80, 99, 85, 84)),
  p('hunter-74', 'Catfish Hunter', 'athletics', 'Athletics', '1970s', ['P'], '3.26', '1.20', 2012, 224, pitcherRatings(82, 82, 82, 85, 85)),
  h('canseco-90', 'Jose Canseco', 'athletics', 'Athletics', '1980s', ['RF'], '.266', 462, 1407, 200, '.859', hitterRatings(72, 92, 75, 88, 85)),

  h('ripken-01', 'Cal Ripken Jr.', 'orioles', 'Orioles', '1990s', ['SS'], '.276', 431, 1695, 36, '.787', hitterRatings(78, 88, 55, 85, 80)),
  h('murray-88', 'Eddie Murray', 'orioles', 'Orioles', '1980s', ['1B'], '.287', 504, 1917, 110, '.817', hitterRatings(82, 90, 60, 88, 84)),
  p('palmer-85', 'Jim Palmer', 'orioles', 'Orioles', '1970s', ['P'], '2.86', '1.18', 2212, 268, pitcherRatings(90, 88, 85, 88, 88)),

  h('griffey-99', 'Ken Griffey Jr.', 'mariners', 'Mariners', '1990s', ['CF'], '.284', 630, 1836, 184, '.907', hitterRatings(82, 94, 82, 92, 92)),
  h('edgar-01', 'Edgar Martinez', 'mariners', 'Mariners', '1990s', ['3B'], '.312', 309, 1261, 38, '.933', hitterRatings(92, 85, 55, 88, 92)),
  p('johnson-01', 'Randy Johnson', 'mariners', 'Mariners', '1990s', ['P'], '3.29', '1.17', 4135, 303, pitcherRatings(85, 88, 96, 90, 90)),

  h('biggio-07', 'Craig Biggio', 'astros', 'Astros', '1990s', ['2B', 'C', 'CF'], '.291', 291, 1175, 414, '.797', hitterRatings(82, 78, 85, 80, 80)),
  h('bagwell-05', 'Jeff Bagwell', 'astros', 'Astros', '1990s', ['1B'], '.297', 449, 1529, 202, '.948', hitterRatings(85, 92, 75, 90, 93)),
  p('clemens-98', 'Roger Clemens', 'astros', 'Astros', '1990s', ['P'], '3.12', '1.17', 4672, 354, pitcherRatings(86, 88, 94, 92, 90)),

  p('ryan-tex', 'Nolan Ryan', 'rangers', 'Rangers', '1990s', ['P'], '3.19', '1.25', 5714, 324, pitcherRatings(84, 80, 99, 88, 92)),
  h('rodriquez-12', 'Ivan Rodriguez', 'rangers', 'Rangers', '1990s', ['C'], '.296', 311, 1332, 127, '.787', hitterRatings(85, 82, 70, 82, 80)),
  h('beltran-16', 'Adrian Beltre', 'rangers', 'Rangers', '2010s', ['3B'], '.286', 477, 1707, 120, '.819', hitterRatings(82, 88, 65, 88, 84)),

  h('carter-93', 'Joe Carter', 'blue-jays', 'Blue Jays', '1990s', ['RF'], '.262', 396, 1445, 140, '.780', hitterRatings(75, 88, 72, 85, 78)),
  p('halladay-12', 'Roy Halladay', 'blue-jays', 'Blue Jays', '2000s', ['P'], '3.38', '1.18', 2117, 203, pitcherRatings(82, 86, 85, 85, 88)),
  h('alou-94', 'Moises Alou', 'astros', 'Astros', '1990s', ['LF'], '.303', 332, 1287, 106, '.871', hitterRatings(85, 85, 70, 85, 86)),

  h('gwynn-pad', 'Tony Gwynn', 'padres', 'Padres', '1980s', ['RF'], '.338', 135, 1138, 319, '.847', hitterRatings(98, 72, 75, 85, 88)),
  p('hoffman-08', 'Trevor Hoffman', 'padres', 'Padres', '1990s', ['P'], '2.87', '1.04', 1133, 0, pitcherRatings(90, 92, 82, 60, 75)),

  p('strasburg-19', 'Stephen Strasburg', 'nationals', 'Nationals', '2010s', ['P'], '3.30', '1.08', 1713, 89, pitcherRatings(82, 90, 88, 72, 78)),
  h('harper-22', 'Bryce Harper', 'nationals', 'Nationals', '2010s', ['RF'], '.279', 42, 120, 15, '.906', hitterRatings(80, 88, 72, 82, 88)),
  h('rendon-19', 'Anthony Rendon', 'nationals', 'Nationals', '2010s', ['3B'], '.290', 25, 120, 8, '.820', hitterRatings(85, 72, 65, 78, 80)),

  h('thome-06', 'Jim Thome', 'white-sox', 'White Sox', '1990s', ['1B'], '.263', 612, 1699, 20, '.956', hitterRatings(78, 96, 50, 92, 92)),
  p('buehrle-12', 'Mark Buehrle', 'white-sox', 'White Sox', '2000s', ['P'], '3.82', '1.25', 1850, 214, pitcherRatings(78, 82, 80, 82, 85)),
  h('frank-thomas', 'Frank Thomas', 'white-sox', 'White Sox', '1990s', ['1B'], '.301', 521, 1704, 12, '.990', hitterRatings(90, 95, 45, 95, 96)),

  h('lofton-07', 'Kenny Lofton', 'guardians', 'Indians', '1990s', ['CF'], '.299', 130, 803, 622, '.818', hitterRatings(88, 72, 92, 82, 85)),
  p('feller-54', 'Bob Feller', 'guardians', 'Indians', '1940s', ['P'], '3.25', '1.32', 2581, 266, pitcherRatings(88, 78, 90, 88, 88)),
  h('belle-95', 'Albert Belle', 'guardians', 'Indians', '1990s', ['LF'], '.295', 381, 1239, 171, '.904', hitterRatings(82, 92, 70, 88, 88)),

  h('brett-85', 'George Brett', 'royals', 'Royals', '1980s', ['3B'], '.305', 317, 1596, 201, '.857', hitterRatings(92, 88, 75, 90, 90)),
  p('saberhagen-89', 'Bret Saberhagen', 'royals', 'Royals', '1980s', ['P'], '3.34', '1.18', 1715, 167, pitcherRatings(85, 88, 85, 82, 82)),

  h('carew-77', 'Rod Carew', 'twins', 'Twins', '1970s', ['1B'], '.328', 92, 1015, 353, '.822', hitterRatings(95, 72, 85, 85, 86)),
  p('viola-91', 'Frank Viola', 'twins', 'Twins', '1980s', ['P'], '3.90', '1.28', 1652, 176, pitcherRatings(78, 80, 82, 82, 80)),

  h('trout-20', 'Mike Trout', 'angels', 'Angels', '2010s', ['CF'], '.298', 350, 900, 220, '.990', hitterRatings(88, 92, 90, 90, 96)),
  p('weaver-14', 'Jered Weaver', 'angels', 'Angels', '2010s', ['P'], '3.63', '1.20', 2100, 150, pitcherRatings(82, 86, 85, 78, 82)),

  h('stanton-17', 'Giancarlo Stanton', 'marlins', 'Marlins', '2010s', ['RF'], '.268', 350, 900, 10, '.920', hitterRatings(75, 96, 55, 88, 90)),
  p('johnson-04', 'Josh Johnson', 'marlins', 'Marlins', '2000s', ['P'], '3.40', '1.25', 1200, 80, pitcherRatings(82, 84, 85, 72, 78)),

  h('yelich-19', 'Christian Yelich', 'brewers', 'Brewers', '2010s', ['LF'], '.290', 180, 650, 160, '.850', hitterRatings(85, 82, 88, 82, 86)),
  p('burnes-23', 'Corbin Burnes', 'brewers', 'Brewers', '2020s', ['P'], '3.20', '1.05', 900, 60, pitcherRatings(88, 92, 88, 70, 75)),

  h('walker-97', 'Larry Walker', 'rockies', 'Rockies', '1990s', ['RF'], '.313', 383, 1311, 230, '.965', hitterRatings(88, 90, 82, 90, 92)),
  p('jennings-06', 'Jason Jennings', 'rockies', 'Rockies', '2000s', ['P'], '4.50', '1.40', 600, 45, pitcherRatings(70, 72, 72, 65, 70)),

  h('goldschmidt-23', 'Paul Goldschmidt', 'diamondbacks', 'Diamondbacks', '2010s', ['1B'], '.290', 320, 1000, 120, '.900', hitterRatings(85, 88, 65, 88, 88)),
  p('johnson-01-randy', 'Randy Johnson', 'diamondbacks', 'Diamondbacks', '2000s', ['P'], '3.29', '1.17', 4135, 303, pitcherRatings(85, 88, 96, 90, 90)),

  p('price-18', 'David Price', 'rays', 'Rays', '2010s', ['P'], '3.42', '1.20', 1800, 140, pitcherRatings(82, 86, 88, 82, 85)),
  h('longoria-16', 'Evan Longoria', 'rays', 'Rays', '2010s', ['3B'], '.267', 340, 1100, 20, '.820', hitterRatings(78, 88, 55, 85, 82)),
  p('snell-23', 'Blake Snell', 'rays', 'Rays', '2020s', ['P'], '3.20', '1.10', 1200, 80, pitcherRatings(88, 90, 88, 72, 78)),
]


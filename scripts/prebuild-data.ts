import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const lahmanPeople = join(root, 'data/lahman/People.csv')
const generatedPlayers = join(root, 'src/data/generated/players.json')

if (existsSync(lahmanPeople)) {
  execSync('npm run build:data', { stdio: 'inherit', cwd: root })
} else if (existsSync(generatedPlayers)) {
  console.log('Using committed src/data/generated (run npm run fetch:lahman to refresh Lahman CSV)')
} else {
  console.error(
    'Missing player data. Run:\n  npm run fetch:lahman   # requires Rscript\n  npm run build:data',
  )
  process.exit(1)
}

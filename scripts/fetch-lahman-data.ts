/**
 * Downloads Lahman database (via CRAN) and exports CSV for the build pipeline.
 * Player names match Baseball Reference (bbrefID column).
 *
 * Requires: curl, tar, Rscript
 * Run: npm run fetch:lahman
 */
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const lahmanDir = join(root, 'data/lahman')
const sourceDir = join(root, 'data/lahman/source')
const exportScript = join(root, 'scripts/export-lahman-csv.R')
const cranUrl =
  'https://cran.r-project.org/src/contrib/Lahman_14.0-0.tar.gz'
const tmpTar = join(root, 'data/lahman/.lahman-r.tar.gz')

function run(cmd: string) {
  execSync(cmd, { stdio: 'inherit', cwd: root })
}

function main() {
  mkdirSync(lahmanDir, { recursive: true })
  if (!existsSync(exportScript)) {
    throw new Error(`Missing ${exportScript}`)
  }

  console.log('Downloading Lahman 14.0 from CRAN…')
  run(`curl -fsSL "${cranUrl}" -o "${tmpTar}"`)

  const extractDir = join(lahmanDir, '.rdata-extract')
  rmSync(extractDir, { recursive: true, force: true })
  mkdirSync(extractDir, { recursive: true })
  mkdirSync(sourceDir, { recursive: true })

  console.log('Extracting RData tables…')
  run(
    `tar -xzf "${tmpTar}" -C "${extractDir}" Lahman/data/People.RData Lahman/data/Batting.RData Lahman/data/Pitching.RData Lahman/data/Fielding.RData Lahman/data/TeamsFranchises.RData Lahman/data/Appearances.RData Lahman/data/Teams.RData`,
  )

  const rDataPath = join(extractDir, 'Lahman/data')
  run(`Rscript "${exportScript}" "${rDataPath}" "${lahmanDir}"`)
  const teamsR = join(rDataPath, 'Teams.RData')
  const teamsCsv = join(lahmanDir, 'Teams.csv')
  run(
    `Rscript -e "load('${teamsR}'); write.csv(Teams, '${teamsCsv}', row.names=FALSE)"`,
  )

  rmSync(extractDir, { recursive: true, force: true })
  console.log(`Lahman CSV ready in ${lahmanDir}`)
}

main()

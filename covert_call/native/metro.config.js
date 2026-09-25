// Metro config for the monorepo: the native app imports from ../shared (incidents, video, codes), which lives
// outside the native/ project root, and its node_modules are hoisted to the covert_call/ workspace root. Without
// watchFolders + nodeModulesPaths, Metro can't resolve either. (Epic 12.)
const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '..')

const config = getDefaultConfig(projectRoot)

// Watch the whole workspace so shared/ changes trigger reloads and resolve.
config.watchFolders = [workspaceRoot]
// Resolve packages from the app's own node_modules first, then the hoisted workspace node_modules.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]
config.resolver.disableHierarchicalLookup = true

module.exports = config

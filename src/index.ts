import { loadEnv as loadEnvFile, PluginOption } from 'vite'
import * as path from 'path'
import * as fs from 'fs'

export interface SetEnvPluginConfig {
  envPrefix?: string
  loadPath?: string[]
  env?: Record<string, Record<string, string>>
}
type EnvMap = Map<string, Record<string, string>>

const root = process.cwd()

const loadPathEnvFile = (
  envMap: EnvMap,
  loadPath: SetEnvPluginConfig['loadPath']
) => {
  if (!Array.isArray(loadPath)) {
    return
  }

  return Promise.all(
    loadPath.map(async filePath => {
      const pp = path.resolve(root, filePath)
      if (!fs.existsSync(pp)) {
        return
      }

      const fileConfig = await import(pp)
      setLineConfig(envMap, fileConfig.default)
    })
  )
}

const loadPackageConfig = (envMap: EnvMap) => {
  const pkgPath = path.resolve(root, 'package.json')
  if (!fs.existsSync(pkgPath)) {
    return
  }

  return import(pkgPath)
    .then(pkg => {
      setLineConfig(envMap, pkg['vite-env'])
    })
    .catch(() => null)
}

const setLineConfig = (envMap: EnvMap, lineEnv: SetEnvPluginConfig['env']) => {
  if (!lineEnv) {
    return
  }

  Object.keys(lineEnv).forEach(mode => {
    let config = envMap.get(mode)
    if (!config) {
      envMap.set(mode, (config = {}))
    }

    const lineConfig = lineEnv[mode]
    Object.keys(lineConfig).forEach(key => {
      config![key] = lineConfig[key]
    })
  })
}

/**
 * @description 设置 vite 环境变量的插件，它会在构建开始前，将环境变量添加到 vite 环境变量中
 * @description 加载顺序为：行内 > .env结尾文件 > packages.json(vite-env) > 自定义目录
 * @description 加载的文件格式有 .env开头, .json, .js, .ts 文件
 *
 * @param {string} envPrefix 环境变量前缀，它等同于 vite.envPrefix 选项，但是优先级更高
 * @param {string[]} loadPath 加载的文件路径，查找会以 vite.config 的路径为根路径进行查找
 * @param {Record<string, Record<string, string>>} env 行内环境变量选项
 */
export default function ViteEnvConfigPlugin(
  inlineConfig: SetEnvPluginConfig
): PluginOption {
  return {
    name: 'set-env-plugin',
    enforce: 'pre',
    async config(config, { mode }) {
      const { envPrefix = 'VITE_', env, loadPath } = inlineConfig

      if (envPrefix) {
        config.envPrefix = envPrefix
      }

      const envMap = new Map()
      await loadPathEnvFile(envMap, loadPath)
      await loadPackageConfig(envMap)
      setLineConfig(envMap, env)

      const activeEnvConfig = envMap.get(mode)
      if (activeEnvConfig) {
        Object.keys(activeEnvConfig).forEach(key => {
          process.env[envPrefix + key] = activeEnvConfig[key]
        })
      }
    }
  }
}

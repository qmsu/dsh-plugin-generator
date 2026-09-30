// 注册全部 scaffold_* 工具。
import { registerPlanTool } from './plan.js'
import { registerCreateTool } from './create.js'
import { registerWriteFileTool } from './write-file.js'
import { registerReadReferenceTool } from './read-reference.js'
import { registerValidateTool } from './validate.js'
import { registerPackageTool } from './package.js'
import { registerInstallTool } from './install.js'
import { registerCaptureTool } from './capture.js'
import { registerProbeTool } from './probe.js'

export function registerScaffoldTools(ctx, config) {
  registerPlanTool(ctx, config)
  registerCreateTool(ctx, config)
  registerWriteFileTool(ctx, config)
  registerReadReferenceTool(ctx, config)
  registerValidateTool(ctx, config)
  registerPackageTool(ctx, config)
  registerInstallTool(ctx)
  registerCaptureTool(ctx)
  registerProbeTool(ctx)
}

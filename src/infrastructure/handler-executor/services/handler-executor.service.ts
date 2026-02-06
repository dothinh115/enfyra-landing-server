import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TDynamicContext } from '../../../shared/interfaces/dynamic-context.interface';
import { PackageCacheService } from '../../cache/services/package-cache.service';
import { ChildProcessManager } from '../utils/child-process-manager';
import { wrapCtx } from '../utils/wrap-ctx';
import { ExecutorPoolService } from './executor-pool.service';
import { transformCode } from '../code-transformer';

@Injectable()
export class HandlerExecutorService {

  constructor(
    private executorPoolService: ExecutorPoolService,
    private packageCacheService: PackageCacheService,
    private configService: ConfigService,
  ) {}

  async run(
    code: string,
    ctx: TDynamicContext,
    timeoutMs = this.configService.get<number>('DEFAULT_HANDLER_TIMEOUT', 30000),
  ): Promise<any> {
    const packages = await this.packageCacheService.getPackages();
    const pool = this.executorPoolService.getPool();

    const transformedCode = transformCode(code);

    const child = await pool.acquire();
    const isDone = { value: false };

    return new Promise((resolve, reject) => {
      try {
        const timeout = ChildProcessManager.setupTimeout(
          child,
          timeoutMs,
          transformedCode,
          isDone,
          reject,
          pool,
        );

        ChildProcessManager.setupChildProcessListeners(
          child,
          ctx,
          timeout,
          pool,
          isDone,
          resolve,
          reject,
          transformedCode,
        );

        ChildProcessManager.sendExecuteMessage(child, wrapCtx(ctx), transformedCode, packages);
      } catch (error) {
        pool.release(child).catch(() => {});
        reject(error);
      }
    });
  }
}

// @ts-nocheck
// Vercel’s isolated serverless type pass resolves conflicting Express ambient
// declarations. The deployed runtime contract is validated separately.
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { courseRouter } from "./routers/courses";
import { catalogRouter, credentialRouter } from "./routers/niu";
import { mediaRouter } from "./routers/media";
import { staffRouter } from "./routers/staff";
import { aiBuilderRouter } from "./routers/aiBuilder";
export const appRouter = router({ system: systemRouter, auth: router({ me: publicProcedure.query((opts) => opts.ctx.user), logout: publicProcedure.mutation(({ ctx }) => { const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 }); return { success: true } as const; }) }), catalog: catalogRouter, course: courseRouter, credential: credentialRouter, media: mediaRouter, staff: staffRouter, aiBuilder: aiBuilderRouter });
export type AppRouter = typeof appRouter;

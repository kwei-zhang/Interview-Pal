export const mount = process.env.TEST_BASE_PATH || '';
export const mountedPath = (path: string) => path === '/' && mount ? mount : `${mount}${path}`;

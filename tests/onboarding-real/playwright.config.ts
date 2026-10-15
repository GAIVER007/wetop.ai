import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch:'*.spec.ts',workers:1,timeout:600000,expect:{timeout:20000},
  use:{actionTimeout:20000,baseURL:'http://127.0.0.1:55843',viewport:{width:1440,height:1000},trace:'off'},
  webServer:[
    {command:'npx tsx --tsconfig apps/api/tsconfig.json tests/onboarding-real/api.ts',cwd:'../..',url:'http://127.0.0.1:55844/__onboarding-test/health',reuseExistingServer:false,env:{DATABASE_SCHEMA:'pms_test',AUTH_REQUIRED:'1',SESSION_SECRET:'synthetic-onboarding-local-replay-key',REGISTRATION_OPEN:'1',APP_URL:'http://127.0.0.1:55843'}},
    {command:'npm exec -w apps/web -- next dev --port 55843 --hostname 127.0.0.1',cwd:'../..',url:'http://127.0.0.1:55843/register',reuseExistingServer:false,timeout:120000,env:{APP_UI_TEST:'1',APP_API_URL:'http://127.0.0.1:55844',APP_AUTH_REQUIRED:'1',APP_URL:'http://127.0.0.1:55843',WETOP_SITE_URL:'http://127.0.0.1:55845',SITE_ORIGINS:'http://127.0.0.1:55845'}},
    {command:'npm exec -w apps/site -- next dev --port 55845 --hostname 127.0.0.1',cwd:'../..',url:'http://127.0.0.1:55845',reuseExistingServer:false,timeout:120000,env:{WETOP_APP_URL:'http://127.0.0.1:55843',WETOP_SITE_URL:'http://127.0.0.1:55845'}}
  ]
});

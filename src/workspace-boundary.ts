/** Per-request D1 ownership check: a cross-bound Worker/D1 deployment must fail closed. */
import {fail,type Env} from './core';
export const EXPECTED_APP='KestrelMesh';
export const EXPECTED_WORKER='portfolio-kestrelmesh';
export const EXPECTED_DATABASE='portfolio-kestrelmesh-db';
type BindingRow={app_name:string;worker_name:string;database_name:string;policy:string};
export async function assertWorkspaceBinding(env:Env):Promise<void>{
  let row:BindingRow|null=null;
  try{
    row=await env.DB.prepare('SELECT app_name,worker_name,database_name,policy FROM app_workspace_binding WHERE slot=1').first<BindingRow>();
  }catch{fail(503,'Workspace database binding unavailable');}
  if(!row || row.app_name!==EXPECTED_APP || row.worker_name!==EXPECTED_WORKER ||
     row.database_name!==EXPECTED_DATABASE || row.policy!=='single-workspace'){
    fail(503,'Workspace database binding mismatch');
  }
}
export async function getWorkspaceBoundary(env:Env){
  await assertWorkspaceBinding(env);
  return {app:EXPECTED_APP,worker:EXPECTED_WORKER,database:EXPECTED_DATABASE,
    mode:'single-workspace',multitenant:false,organization_accounts:false,verified:true,
    note:'This installation contains one isolated workspace. It does not provide tenant-scoped authorization or SSO.'};
}

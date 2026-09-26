/** Synthetic data only, imported exclusively by the loopback UI fixture server. */
const seed={id:'a1111111-1111-4111-8111-111111111111',name:'Тестовый агент',scenario:'sales',lifecycle:'draft',updatedAt:'2026-09-26T00:00:00.000Z',profile:{assistantName:'Тестовый агент',businessName:'Вымышленный хостел',niche:'Хостел',goal:'Помочь гостю',description:'',advantages:'',currency:'KZT',timezone:'Asia/Almaty',botType:'sales'}};
let agent=structuredClone(seed);
export function resetAgentFixture(){agent=structuredClone(seed);}
export function agentFixture(path:string,method:string,body:Record<string,unknown>):{status:number;data:unknown}|null {
 if(path==='/seller-agents')return {status:200,data:{items:[agent]}};
 if(path!==`/seller-agents/${agent.id}`)return null;
 if(method==='GET')return {status:200,data:agent};
 if(method==='PATCH'){
  if(body.updatedAt!==agent.updatedAt)return {status:409,data:{message:'Агент изменён в другой вкладке. Обновите карточку'}};
  const profile=body.profile as typeof agent.profile;
  agent={...agent,profile,name:profile.assistantName||profile.businessName,updatedAt:new Date(Date.parse(agent.updatedAt)+1).toISOString()};
  return {status:200,data:{id:agent.id,updatedAt:agent.updatedAt}};
 }
 return {status:405,data:{}};
}

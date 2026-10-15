// Bounded, predictable HTTP/JSON transport. Never echo untrusted HTML in UI messages.
export async function requestJSON(path,{method='GET',data,token='',fetcher=fetch,timeoutMs=18000}={}){
 if(typeof path!=='string'||!path.startsWith('/api/'))throw new Error('Only same-origin API routes are supported');
 const headers={'Accept':'application/json'};
 if(token)headers.Authorization='Bearer '+token;
 if(data!==undefined)headers['Content-Type']='application/json';
 let response;
 try{response=await fetcher(path,{method,headers,body:data===undefined?undefined:JSON.stringify(data),cache:'no-store',signal:AbortSignal.timeout(timeoutMs),redirect:'error'});}
 catch(e){if(e?.name==='AbortError'||e?.name==='TimeoutError')throw new Error('The request timed out. Try again.');throw new Error('Cannot reach the application API. Check your connection and retry.');}
 const media=(response.headers?.get('Content-Type')||'').toLowerCase();
 if(!media.includes('application/json'))throw new Error(`The API returned an unexpected response (HTTP ${response.status}).`);
 let payload;
 try{payload=await response.json()}catch{throw new Error(`The API returned invalid JSON (HTTP ${response.status}).`)}
 if(!response.ok){const message=typeof payload?.error==='string'&&payload.error.length<240?payload.error:`Request rejected (HTTP ${response.status}).`;throw new Error(message)}
 return payload;
}

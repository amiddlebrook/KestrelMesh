// Scoped, user-initiated exports. Never silently export the entire protected database.
export function downloadArtifact(filename,artifact){
 const blob=new Blob([JSON.stringify(artifact,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();
 setTimeout(()=>URL.revokeObjectURL(url),2000);
}

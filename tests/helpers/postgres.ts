import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Client} from 'pg';
const pgBin=process.env.PG_BIN || (existsSync('/opt/homebrew/opt/postgresql@17/bin/initdb')?'/opt/homebrew/opt/postgresql@17/bin/':'');
async function command(binary:string,args:string[]) {
  await new Promise<void>((resolve,reject)=>{
    const child=spawn(`${pgBin}${binary}`,args,{stdio:['ignore','pipe','pipe']});let output='';
    child.stdout.on('data',c=>output+=c);child.stderr.on('data',c=>output+=c);
    child.on('error',reject);child.on('close',code=>code===0?resolve():reject(new Error(output)));
  });
}
export async function temporaryPostgres(port?:number) {
  const root=await mkdtemp(join(tmpdir(),'interview-pal-pg-')),data=join(root,'data');
  let started=false;
  try {
    await command('initdb',['-D',data,'-U','postgres','-A','trust','--no-locale','-E','UTF8']);
    await command('pg_ctl',['-D',data,'-l',join(root,'postgres.log'),'-o',`-k ${root} -p ${port||55439} -c listen_addresses='${port?'127.0.0.1':''}'`,'-w','start']);started=true;
    const config={host:root,port:port||55439,user:'postgres',database:'postgres'};
    const connect=async()=>{const db=new Client(config);await db.connect();return db;};
    return {connect,root,stop:async()=>{await command('pg_ctl',['-D',data,'-m','fast','-w','stop']);await rm(root,{recursive:true,force:true});}};
  } catch(error) {if(started) await command('pg_ctl',['-D',data,'-m','fast','-w','stop']);await rm(root,{recursive:true,force:true});throw error;}
}

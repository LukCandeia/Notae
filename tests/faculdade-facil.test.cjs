// Run with node --test. All mutations use an in-memory vault.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const vaultPath=path.resolve(__dirname,'../vault');
class TFolder{constructor(path){this.path=path;this.name=path.split('/').at(-1);this.children=[];}}
class TFile{
  constructor(path,content=''){this.setPath(path);this.content=content;this.stat={ctime:Date.now()};}
  setPath(path){this.path=path;this.name=path.split('/').at(-1);this.extension=this.name.split('.').at(-1);this.basename=this.name.slice(0,-this.extension.length-1);}
}
class Element{
  constructor(tag='div',options={}){this.tag=tag;this.children=[];this.events={};this.value=options.value||'';this.text=options.text||'';this.attrs=options.attr||{};}
  createEl(tag,options){const el=new Element(tag,options);this.children.push(el);return el;}
  createDiv(options){return this.createEl('div',options);}
  addClass(){} setAttribute(key,value){this.attrs[key]=value;} setText(text){this.text=text;} focus(){} empty(){this.children=[];}
  addEventListener(event,handler){this.events[event]=handler;}
  querySelectorAll(){return this.children.flatMap(el=>[el,...el.querySelectorAll()]);}
}
class Modal{constructor(app){this.app=app;this.contentEl=new Element();this.modalEl=new Element();}setTitle(title){this.title=title;}open(){this.onOpen();}close(){this.onClose();}}
class MarkdownRenderChild{constructor(el){this.containerEl=el;}registerEvent(){}}
class Plugin{}
const notices=[];
const moduleObject={exports:{}};
vm.runInNewContext(fs.readFileSync(path.join(vaultPath,'.obsidian/plugins/notae/main.js'),'utf8'),{
  require(name){assert.equal(name,'obsidian');return {Plugin,Modal,Notice:class{constructor(text){notices.push(text);}},TFile,TFolder,MarkdownRenderChild,normalizePath:p=>p.replaceAll('\\','/')};},
  module:moduleObject,URL,URLSearchParams,Uint8Array,window:{moment:()=>({format:()=> '08/11/2026'}),setTimeout,clearTimeout}
});
const FaculdadeFacil=moduleObject.exports;
const helpers=FaculdadeFacil._test;
function fixture(options={}){
  const entries=new Map(),events=new Map();
  const attach=entry=>{entries.set(entry.path,entry);entries.get(entry.path.split('/').slice(0,-1).join('/'))?.children.push(entry);return entry;};
  const detach=entry=>{entries.delete(entry.path);const parent=entries.get(entry.path.split('/').slice(0,-1).join('/'));if(parent)parent.children=parent.children.filter(child=>child!==entry);};
  const seedFolder=p=>{if(entries.has(p))return entries.get(p);const parent=p.split('/').slice(0,-1).join('/');if(parent)seedFolder(parent);return attach(new TFolder(p));};
  const seedFile=(p,content='')=>{seedFolder(p.split('/').slice(0,-1).join('/'));return attach(new TFile(p,content));};
  const vault={
    getName:()=>options.name||'Vault de teste com outro nome',getAbstractFileByPath:p=>entries.get(p)||null,
    getMarkdownFiles:()=>[...entries.values()].filter(e=>e instanceof TFile&&e.extension==='md'),
    on(event,cb){if(!events.has(event))events.set(event,[]);events.get(event).push(cb);return {event,cb};},
    emit(event,file){for(const cb of events.get(event)||[])cb(file);},
    async createFolder(p){if(entries.has(p))throw Error('existing path');if(vault.failFolder===p)throw Error('folder failure');const folder=attach(new TFolder(p));vault.emit('create',folder);return folder;},
    async create(p,content){if(entries.has(p))throw Error('existing file');if(vault.failCreate===p)throw Error('write failure');const file=attach(new TFile(p,content));vault.emit('create',file);return file;},
    async createBinary(p,bytes){return vault.create(p,bytes);},
    async read(file){return file.content;},async cachedRead(file){return file.content;},async readBinary(file){return file.content;},
    async process(file,cb){file.content=cb(file.content);},async delete(file){assert.equal(file.children.length,0);detach(file);},async trash(file){detach(file);}
  };
  const app={vault,workspace:{getActiveFile:()=>app.active||null,getLeaf:()=>({openFile:async file=>{app.opened=file;}}),openLinkText:async p=>{app.openedPath=p;}},
    fileManager:{generateMarkdownLink:file=>'[['+file.path+']]',renameFile:async(file,p)=>{const old=file.path;detach(file);file.setPath(p);attach(file);for(const other of vault.getMarkdownFiles())other.content=other.content.replaceAll(old,p);}},
    metadataCache:{getFileCache:file=>({links:file.refs||[]}),getFirstLinkpathDest:p=>entries.get(p)||null}
  };
  seedFolder('Para organizar/Arquivos');seedFile('Para organizar/Caixa de entrada.md');
  if(options.seedCourses!==false)for(const course of [{name:'Cálculo I'},{name:'Programação Modular'}])seedFile('Disciplinas/'+course.name+'/'+course.name+'.md','# '+course.name);
  for(const name of ['Aula','Exercício','Material','Trabalho ou prova'])seedFile('Modelos/'+name+'.md',fs.readFileSync(path.join(vaultPath,'Modelos',name+'.md'),'utf8'));
  const plugin=new FaculdadeFacil();plugin.app=app;plugin.work=Promise.resolve();
  return {plugin,app,vault,entries,seedFolder,seedFile};
}
const bytes=text=>new TextEncoder().encode(text).buffer;
const upload=(name,text)=>({name,arrayBuffer:async()=>bytes(text)});

test('discovers folders without a fixed discipline list',()=>{
  const {plugin}=fixture();assert.equal(plugin.targets('disciplina').length,2);assert.equal(plugin.targetBy('Programação Modular').name,'Programação Modular');
  assert.equal(helpers.parseTitle('Programação Modular - Aula - Módulos',v=>plugin.targetBy(v)).course.name,'Programação Modular');
});
test('creates a study with practical folders, hub queries and encoded action',async()=>{
  const {plugin,entries}=fixture();const hub=await plugin.createTarget('estudo','Git e GitHub');
  for(const dir of ['Anotações','Práticas','Materiais','Materiais/Arquivos'])assert.ok(entries.get('Estudos independentes/Git e GitHub/'+dir) instanceof TFolder);
  assert.match(hub.content,/path:"Estudos independentes\/Git e GitHub\/Práticas\/"/);
  const url=new URL(hub.content.match(/\]\((obsidian:[^)]+)\)/)[1]);assert.equal(url.searchParams.get('destino'),'Estudos independentes/Git e GitHub');
  assert.equal(plugin.targets('estudo').length,1);assert.equal(plugin.targetForPath(hub.path).name,'Git e GitHub');
});
test('creates a future discipline without changing existing pages',async()=>{
  const {plugin,entries}=fixture();const before=entries.get('Disciplinas/Cálculo I/Cálculo I.md').content;
  await plugin.createTarget('disciplina','Banco de Dados');assert.equal(plugin.targets('disciplina').length,3);
  assert.ok(entries.has('Disciplinas/Banco de Dados/Trabalhos e provas'));assert.equal(entries.get('Disciplinas/Cálculo I/Cálculo I.md').content,before);
  assert.equal(helpers.parseTitle('Banco de Dados - Aula - SQL',v=>plugin.targetBy(v)).course.name,'Banco de Dados');
});
test('rejects duplicate and invalid names without mutations',async()=>{
  const {plugin,entries}=fixture();await plugin.createTarget('estudo','Linux');
  for(const name of ['Linux','linux','Línux','','../Teste','CON','com1','Nome/Outro','Nome#','A\nB','.oculto','A`B','A'.repeat(81)]){
    const before=entries.size;await assert.rejects(plugin.createTarget('estudo',name));assert.equal(entries.size,before,name);
  }
  await assert.rejects(plugin.createTarget('toString','Teste'));
});
test('rejects existing folders even if they have no hub',async()=>{
  const {plugin,seedFolder}=fixture();seedFolder('Estudos independentes/Linux');await assert.rejects(plugin.createTarget('estudo','Linux'),/Já existe/);
});
test('rolls back only new empty folders on failed creation',async()=>{
  const {plugin,vault,entries}=fixture();const before=[...entries.keys()];vault.failCreate='Estudos independentes/Linux/Linux.md';
  await assert.rejects(plugin.createTarget('estudo','Linux'),/write failure/);assert.deepEqual([...entries.keys()],before);
  vault.failCreate='';vault.failFolder='Estudos independentes/Linux/Materiais';await assert.rejects(plugin.createTarget('estudo','Linux'),/folder failure/);assert.deepEqual([...entries.keys()],before);
});
test('distinguishes matching names in both categories and refuses ambiguous routing',async()=>{
  const {plugin}=fixture();await plugin.createTarget('estudo','Linux');await plugin.createTarget('disciplina','Linux');
  assert.equal(plugin.targetBy('Linux'),null);assert.equal(plugin.targetBy('Linux','estudo').kind,'estudo');assert.equal(plugin.targetBy('Disciplinas/Linux').kind,'disciplina');
  assert.equal(helpers.parseTitle('Linux - Aula - Teste',v=>plugin.targetBy(v)),null);
});
test('creates notes in the appropriate study and discipline folders',async()=>{
  const {plugin}=fixture();await plugin.createTarget('estudo','Linux');const target=plugin.targetBy('Linux');
  for(const [type,dir]of [['aula','Anotações'],['exercicio','Práticas'],['material','Materiais']]){
    const file=await plugin.createStudyNote(target,type,'Teste '+type,[],'Texto pessoal');
    assert.equal(file.path,`Estudos independentes/Linux/${dir}/Teste ${type}.md`);assert.match(file.content,/Texto pessoal/);assert.match(file.content,/\[\[Estudos independentes\/Linux\/Linux\|Linux\]\]/);
  }
  const course=plugin.targetBy('Programação Modular');const note=await plugin.createStudyNote(course,'prova','P2');assert.match(note.path,/Trabalhos e provas\/P2.md$/);
  await assert.rejects(plugin.createStudyNote(target,'prova','P2'));await assert.rejects(plugin.createStudyNote(course,'toString','Teste'));
});
test('keeps repeated note titles and distinct attachments without overwriting',async()=>{
  const {plugin,entries}=fixture();await plugin.createTarget('estudo','Linux');const target=plugin.targetBy('Linux');
  const a=await plugin.createStudyNote(target,'material','Manual',[upload('manual.pdf','A')]);
  await plugin.createStudyNote(target,'material','Manual',[upload('manual.pdf','A')]);
  await plugin.createStudyNote(target,'material','Manual',[upload('manual.pdf','B')]);
  assert.ok(entries.has('Estudos independentes/Linux/Materiais/Manual (3).md'));assert.match(a.content,/!\[\[.*manual.pdf\]\]/);
  const attachments=[...entries.keys()].filter(p=>p.endsWith('.pdf'));assert.equal(attachments.length,2);assert.ok(attachments.some(p=>p.endsWith('manual (2).pdf')));
});
test('failed note creation removes only new attachment copies',async()=>{
  const {plugin,vault,entries}=fixture();await plugin.createTarget('estudo','Linux');const target=plugin.targetBy('Linux');
  await plugin.createStudyNote(target,'material','Primeira',[upload('manual.pdf','A')]);
  vault.failCreate=target.path+'/Materiais/Falha.md';
  await assert.rejects(plugin.createStudyNote(target,'material','Falha',[upload('manual.pdf','A'),upload('novo.pdf','B')]));
  assert.ok(entries.has(target.path+'/Materiais/Arquivos/manual.pdf'));assert.ok(!entries.has(target.path+'/Materiais/Arquivos/novo.pdf'));
});
test('assigns inbox practice and its attachments to the study',async()=>{
  const {plugin,seedFile,entries}=fixture();await plugin.createTarget('estudo','Linux');
  const file=await plugin.createStudyNote(null,'exercicio','Permissões',[],'Minha prática');
  const attachment=seedFile('Para organizar/Arquivos/exemplo.txt',bytes('conteúdo'));file.refs=[{link:attachment.path}];file.content+='\n[['+attachment.path+']]';
  await plugin.assignCourse(file,plugin.targetBy('Linux'));
  assert.equal(file.path,'Estudos independentes/Linux/Práticas/Permissões.md');assert.match(file.content,/Estudos independentes\/Linux\/Linux\|Linux/);
  assert.ok(entries.has('Estudos independentes/Linux/Materiais/Arquivos/exemplo.txt'));assert.match(file.content,/Estudos independentes\/Linux\/Materiais\/Arquivos\/exemplo.txt/);
});
test('manual destination and type work for unclassified inbox notes',async()=>{
  const {plugin,seedFile}=fixture();await plugin.createTarget('estudo','Git');const file=seedFile('Para organizar/Branches.md','Minhas notas');
  await plugin.assignCourse(file,plugin.targetBy('Git'),'exercicio');assert.equal(file.path,'Estudos independentes/Git/Práticas/Branches.md');assert.match(file.content,/\[\[Estudos independentes\/Git\/Git\|Git\]\]/);
});
test('routes new and legacy titles and excludes Markdown attachments',async()=>{
  const {plugin,seedFile}=fixture();await plugin.createTarget('estudo','Linux');
  const file=seedFile('Para organizar/Linux - Exercício - Terminal.md');assert.equal(await plugin.routeNote(file),true);assert.match(file.path,/Linux\/Práticas\//);
  const legacy=seedFile('Para organizar/Programação Modular - Aula - Módulos.md');assert.equal(await plugin.routeNote(legacy),true);assert.match(legacy.path,/Disciplinas\/Programação Modular\/Anotações/);
  const attachment=seedFile('Para organizar/Arquivos/Programação Modular - Aula - Anexo.md');assert.equal(await plugin.routeNote(attachment),false);await assert.rejects(plugin.assignCourse(attachment,plugin.targetBy('Programação Modular')));
});
test('rejects destinations removed while a form was open',async()=>{
  const {plugin,entries}=fixture();const target=plugin.targetBy('Programação Modular');entries.delete(target.path+'/'+target.name+'.md');
  await assert.rejects(plugin.createStudyNote(target,'aula','Teste'),/destino não está mais disponível/);
});
test('routes semester names with hyphens and updates the inbox backlink once',async()=>{
  const {plugin,seedFile}=fixture();await plugin.createTarget('disciplina','Cálculo I - 2027.1');
  const file=seedFile('Para organizar/Cálculo I - 2027.1 - Aula - Limites.md','Meu conteúdo\n[[Para organizar/Caixa de entrada|Para organizar]]');
  assert.equal(await plugin.routeNote(file),true);assert.match(file.path,/Disciplinas\/Cálculo I - 2027.1\/Anotações\//);
  assert.match(file.content,/Meu conteúdo/);assert.ok(!file.content.includes('Para organizar/Caixa de entrada'));assert.equal(file.content.match(/\|Cálculo I - 2027.1\]\]/g).length,1);
  const empty=seedFile('Para organizar/Cálculo I - 2027.1 - Aula - Derivadas.md');await plugin.routeNote(empty);assert.equal(empty.content.match(/\|Cálculo I - 2027.1\]\]/g).length,1);
});
test('recent contents include studies but exclude hubs and attachments',()=>{
  for(const [p,expected]of [['Estudos independentes/Linux/Anotações/Terminal.md',true],['Estudos independentes/Linux/Linux.md',false],['Estudos independentes/Linux/Materiais/Arquivos/readme.md',false],['Disciplinas/PM/Anotações/Teste.md',true]])assert.equal(helpers.isContentNote(new TFile(p)),expected);
});
test('capture form selects current context, honors material shortcut and resets incompatible types',async()=>{
  const {plugin,app}=fixture();await plugin.createTarget('estudo','Linux');app.active=plugin.app.vault.getAbstractFileByPath('Estudos independentes/Linux/Linux.md');
  const modal=new helpers.CreateNoteModal(plugin,{material:true});modal.onOpen();assert.equal(modal.course.kind,'estudo');assert.equal(modal.resolvedType(),'material');
  assert.ok(!modal.typeSelect.children.some(el=>el.value==='prova'));
  const select=modal.contentEl.querySelectorAll().find(el=>el.tag==='select');assert.ok(select.children.some(el=>el.tag==='optgroup'&&el.attrs.label==='Disciplinas'));
  const second=new helpers.CreateNoteModal(plugin,{course:'Programação Modular',type:'prova'});second.onOpen();const destination=second.contentEl.querySelectorAll().find(el=>el.tag==='select');
  destination.value='Estudos independentes/Linux';destination.events.change();assert.equal(second.type,'');assert.equal(second.resolvedType(),'aula');
});
test('home lists refresh after creation and exclude incomplete folders',async()=>{
  const {plugin,seedFolder}=fixture();const el=new Element();const list=new helpers.TargetList(el,plugin,'estudo');list.onload();
  assert.match(el.children[0].text,/primeiro tema/);seedFolder('Estudos independentes/Incompleto');assert.equal(plugin.targets('estudo').length,0);
  await plugin.createTarget('estudo','Linux');assert.equal(el.children[0].children[0].children[0].text,'Linux');
});
test('protocol dispatch handles both creation actions, encoded destination and vault isolation',async()=>{
  const {plugin}=fixture();await plugin.createTarget('estudo','Git e GitHub');let options;
  plugin.openCreate=value=>{options=value;};plugin.handleAction({vault:'Outro',acao:'conteudo'});assert.equal(options,undefined);
  plugin.handleAction({acao:'conteudo',destino:'Estudos independentes/Git e GitHub'});assert.equal(options.target,'Estudos independentes/Git e GitHub');
  plugin.handleAction({acao:'nova-disciplina'});plugin.handleAction({acao:'novo-estudo'});
});
test('first use works without any subjects and with arbitrary vault names',async()=>{
  const {plugin,app,seedFile}=fixture({seedCourses:false,name:'Meu espaço de estudos 2027'});
  seedFile('00 - Início.md','# Meus estudos');
  assert.equal(plugin.targets().length,0);
  await plugin.openHome();assert.equal(app.opened.path,'00 - Início.md');
  const course=await plugin.createTarget('disciplina','Matéria de exemplo');
  const study=await plugin.createTarget('estudo','Linux');
  assert.equal(plugin.targets().length,2);
  for(const hub of [course,study]){
    const url=new URL(hub.content.match(/\]\((obsidian:[^)]+)\)/)[1]);
    assert.equal(url.hostname,'notae');assert.equal(url.searchParams.has('vault'),false);
  }
  const file=await plugin.createStudyNote(plugin.targetBy('Linux'),'exercicio','Permissões');
  assert.equal(file.path,'Estudos independentes/Linux/Práticas/Permissões.md');
});
test('generated internal links still work after renaming the vault',async()=>{
  const {plugin,vault}=fixture({seedCourses:false,name:'Nome inicial'});
  const hub=await plugin.createTarget('estudo','Redação');
  const url=new URL(hub.content.match(/\]\((obsidian:[^)]+)\)/)[1]);
  vault.getName=()=> 'Outro nome';let chosen;
  plugin.openCreate=options=>{chosen=options;};
  plugin.handleAction(Object.fromEntries(url.searchParams));
  assert.equal(chosen.target,'Estudos independentes/Redação');
  const modal=new helpers.CreateNoteModal(plugin,chosen);assert.equal(modal.course.name,'Redação');
});
test('startup registers the branded commands and opens home only when no note is active',async()=>{
  const {plugin,app,seedFile}=fixture({seedCourses:false});
  const home=seedFile('00 - Início.md','# Meus estudos');const layouts=[],commands=[],blocks=[];
  plugin.addRibbonIcon=()=>new Element();plugin.registerDomEvent=()=>{};plugin.registerEvent=()=>{};
  plugin.addCommand=command=>commands.push(command);
  plugin.registerMarkdownCodeBlockProcessor=language=>blocks.push(language);
  plugin.registerObsidianProtocolHandler=(protocol,handler)=>{app.protocol={protocol,handler};};
  plugin.registerMarkdownPostProcessor=()=>{};
  app.workspace.on=()=>({});app.workspace.onLayoutReady=callback=>layouts.push(callback);
  app.metadataCache.on=()=>({});
  await plugin.onload();
  assert.equal(app.protocol.protocol,'notae');assert.ok(commands.some(command=>command.id==='abrir-inicio'));
  assert.equal(blocks.length,3);
  for(const callback of layouts)callback();await Promise.resolve();assert.equal(app.opened,home);
  app.opened=null;app.active=seedFile('Outra nota.md','Minha nota');for(const callback of layouts)callback();await Promise.resolve();assert.equal(app.opened,null);
  plugin.onunload();
});

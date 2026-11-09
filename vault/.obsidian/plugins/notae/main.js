'use strict';
// Copyright (c) 2026 LukCandeia. SPDX-License-Identifier: MIT
const { Plugin, Modal, Notice, TFile, TFolder, MarkdownRenderChild, normalizePath } = require('obsidian');

const TYPES = {
  aula:{label:'Anotação de aula',folder:'Anotações',template:'Aula',aliases:['aula','anotacao','anotacoes','nota']},
  exercicio:{label:'Exercício ou prática',folder:'Anotações',template:'Exercício',aliases:['exercicio','pratica','laboratorio']},
  material:{label:'Material ou leitura',folder:'Materiais',template:'Material',aliases:['material','leitura','pdf','slides']},
  trabalho:{label:'Trabalho',folder:'Trabalhos e provas',template:'Trabalho ou prova',aliases:['trabalho','projeto']},
  prova:{label:'Prova',folder:'Trabalhos e provas',template:'Trabalho ou prova',aliases:['prova','avaliacao']}
};
const EMBED_EXTENSIONS=new Set(['pdf','png','jpg','jpeg','gif','svg','webp','avif','bmp','mp3','wav','ogg','m4a','flac','webm','mp4','mov','mkv','ogv','3gp']);
function fold(value){return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();}
function safeName(value){
  let name=String(value).normalize('NFC').replace(/[<>:"/\\|?*\x00-\x1f\[\]#^]/g,' ').replace(/\s+/g,' ').trim().replace(/[. ]+$/,'').slice(0,100).replace(/[. ]+$/,'');
  if(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))name='Arquivo - '+name;
  return name||'Sem título';
}
function typeBy(value){return Object.keys(TYPES).find(k=>k===value||TYPES[k].aliases.includes(fold(value)));}
function parseTitle(title,lookup=()=>null){
  const parts=String(title).split(/\s+[-–—|]\s+/);
  for(let i=parts.length-2;i>=1;i--){
    if(!parts.slice(i+1).join(' ').trim())continue;
    const course=lookup(parts.slice(0,i).join(' - ')),type=typeBy(parts[i]);
    if(course&&type)return {course,type};
  }
  return null;
}
const ROOTS={disciplina:'Disciplinas',estudo:'Estudos independentes'};
function contentFolder(target,type){return target?.kind==='estudo'?(type==='exercicio'?'Práticas':type==='aula'?'Anotações':'Materiais'):TYPES[type].folder;}
function isInboxNote(file){return file instanceof TFile&&file.extension==='md'&&file.path.startsWith('Para organizar/')&&!file.path.startsWith('Para organizar/Arquivos/')&&file.path!=='Para organizar/Caixa de entrada.md';}
function allowedType(target,type){return Object.hasOwn(TYPES,type)&&(target?.kind!=='estudo'||['aula','exercicio','material'].includes(type));}
function populateTargets(select,plugin,emptyLabel){
  select.createEl('option',{text:emptyLabel,value:''});
  for(const [kind,root]of Object.entries(ROOTS)){
    const group=select.createEl('optgroup',{attr:{label:root}});
    for(const target of plugin.targets(kind))group.createEl('option',{text:target.name,value:target.path});
  }
}
function localDate(){return window.moment().format('DD/MM/YYYY');}
function equivalentBuffers(a,b){
  if(a.byteLength!==b.byteLength)return false;
  const x=new Uint8Array(a),y=new Uint8Array(b);
  for(let i=0;i<x.length;i++)if(x[i]!==y[i])return false;
  return true;
}

class CreateNoteModal extends Modal {
  constructor(plugin,options={}){
    super(plugin.app);this.plugin=plugin;this.options=options;
    this.course=options.target?plugin.targetBy(options.target):options.course?plugin.targetBy(options.course,'disciplina'):options.study?plugin.targetBy(options.study,'estudo'):plugin.targetForPath(plugin.app.workspace.getActiveFile()?.path||'');
    this.type=typeBy(options.type)||(options.material?'material':'');
    if(!allowedType(this.course,this.type))this.type='';
    this.files=[];this.busy=false;
  }
  onOpen(){
    this.setTitle('Adicionar conteúdo');
    this.modalEl.addClass('faculdade-facil-modal');
    const form=this.contentEl.createEl('form');
    form.createEl('p',{text:'Guarde agora. Complete suas anotações quando for estudar.',cls:'faculdade-facil-hint'});
    const courseLabel=form.createEl('label',{text:'Destino'});
    const courseSelect=courseLabel.createEl('select');
    populateTargets(courseSelect,this.plugin,'Guardar para depois');
    courseSelect.value=this.course?.path||'';
    courseSelect.addEventListener('change',()=>{this.course=this.plugin.targetBy(courseSelect.value);if(!allowedType(this.course,this.type))this.type='';this.refreshTypes();this.updateDestination();});
    const titleLabel=form.createEl('label',{text:'Título'});
    this.titleInput=titleLabel.createEl('input',{type:'text',placeholder:'Ex.: Lista de limites'});
    this.titleInput.maxLength=100;this.titleInput.required=true;
    const bodyLabel=form.createEl('label',{text:'Conteúdo (opcional)'});
    this.bodyInput=bodyLabel.createEl('textarea',{placeholder:'Cole um texto, um link ou escreva suas anotações.',attr:{rows:'4'}});
    this.bodyInput.addEventListener('input',()=>this.updateDestination());
    {
      const fileLabel=form.createEl('label',{text:'Anexar arquivos (opcional)'});
      this.fileInput=fileLabel.createEl('input',{type:'file'});
      this.fileInput.multiple=true;
      this.fileInput.addEventListener('change',()=>{
        this.addFiles(Array.from(this.fileInput.files||[]));
      });
      this.fileSummary=form.createEl('p',{text:'Você também pode arrastar arquivos para esta janela.',cls:'faculdade-facil-hint',attr:{'aria-live':'polite'}});
      this.clearFiles=form.createEl('button',{text:'Remover seleção',attr:{type:'button'},cls:'faculdade-facil-clear'});
      this.clearFiles.hidden=true;
      this.clearFiles.addEventListener('click',()=>{this.files=[];this.fileInput.value='';this.refreshFiles();});
    }
    form.addEventListener('dragover',event=>{if(Array.from(event.dataTransfer?.types||[]).includes('Files')){event.preventDefault();form.addClass('is-dragging');}});
    form.addEventListener('dragleave',event=>{if(!form.contains(event.relatedTarget))form.removeClass('is-dragging');});
    form.addEventListener('drop',event=>{if(event.dataTransfer?.files.length){event.preventDefault();event.stopPropagation();this.addFiles(Array.from(event.dataTransfer.files));}form.removeClass('is-dragging');});
    const details=form.createEl('details',{cls:'faculdade-facil-details'});
    details.createEl('summary',{text:'Mais opções'});
    const typeLabel=details.createEl('label',{text:'Organizar como'});
    const typeSelect=this.typeSelect=typeLabel.createEl('select');
    this.refreshTypes();
    typeSelect.addEventListener('change',()=>{this.type=typeSelect.value;this.updateDestination();});
    this.destination=form.createEl('p',{cls:'faculdade-facil-destination'});this.updateDestination();
    this.errorEl=form.createEl('p',{cls:'faculdade-facil-error',attr:{role:'alert'}});
    const actions=form.createDiv({cls:'faculdade-facil-actions'});
    this.cancelButton=actions.createEl('button',{text:'Cancelar',attr:{type:'button'}});this.cancelButton.addEventListener('click',()=>this.close());
    this.submitButton=actions.createEl('button',{text:'Guardar conteúdo',attr:{type:'submit'},cls:'mod-cta'});
    form.addEventListener('submit',event=>{event.preventDefault();void this.submit();});
    this.titleInput.focus();
  }
  addFiles(files){
    if(this.busy)return;
    for(const file of files)if(!this.files.some(f=>f.name===file.name&&f.size===file.size&&f.lastModified===file.lastModified))this.files.push(file);
    if(!this.titleInput.value&&this.files.length)this.titleInput.value=this.files[0].name.replace(/\.[^.]+$/,'');
    this.refreshFiles();
  }
  refreshFiles(){this.fileSummary.setText(this.files.length?this.files.map(f=>f.name).join(' · '):'Você também pode arrastar arquivos para esta janela.');this.clearFiles.hidden=!this.files.length;this.updateDestination();}
  resolvedType(){return this.type||(this.files.length||/https?:\/\//i.test(this.bodyInput?.value||'')?'material':'aula');}
  refreshTypes(){
    if(!this.typeSelect)return;
    this.typeSelect.empty();this.typeSelect.createEl('option',{text:'Escolher automaticamente',value:''});
    for(const [key,value]of Object.entries(TYPES))if(allowedType(this.course,key))this.typeSelect.createEl('option',{text:this.course?.kind==='estudo'&&key==='aula'?'Anotação':value.label,value:key});
    this.typeSelect.value=this.type;
  }
  updateDestination(){this.destination?.setText(this.course?'Destino: '+this.course.name+' → '+contentFolder(this.course,this.resolvedType()):'Destino: Para organizar. Você pode escolher uma disciplina ou estudo depois.');}
  async submit(){
    if(this.busy)return;
    if(!this.titleInput.value.trim()){this.errorEl.setText('Escreva um assunto para encontrar esta nota depois.');this.titleInput.focus();return;}
    const course=this.course,type=this.resolvedType(),title=this.titleInput.value,files=this.files.slice(),body=this.bodyInput.value;
    this.busy=true;this.cancelButton.disabled=true;this.submitButton.disabled=true;this.submitButton.setText('Guardando…');this.errorEl.setText('');
    for(const control of this.contentEl.querySelectorAll('input,select,textarea'))control.disabled=true;
    try{
      const note=await this.plugin.runExclusive(()=>this.plugin.createStudyNote(course,type,title,files,body));
      this.busy=false;this.close();
      new Notice(course?'Conteúdo guardado em '+course.name+'.':'Conteúdo guardado em Para organizar.');
      try{await this.app.workspace.getLeaf(false).openFile(note);}catch{new Notice('A nota foi guardada. Abra-a pela pasta de destino.');}
    }catch(error){this.errorEl.setText('Não foi possível guardar: '+error.message);this.busy=false;this.cancelButton.disabled=false;this.submitButton.disabled=false;this.submitButton.setText('Tentar novamente');for(const control of this.contentEl.querySelectorAll('input,select,textarea'))control.disabled=false;}
  }
  close(){if(!this.busy)super.close();}
  onClose(){this.contentEl.empty();}
}

class RecentContents extends MarkdownRenderChild {
  constructor(el,plugin){super(el);this.plugin=plugin;}
  onload(){
    this.render();
    for(const event of ['create','delete','rename','modify'])this.registerEvent(this.plugin.app.vault.on(event,()=>this.render()));
  }
  render(){
    this.containerEl.empty();
    const files=this.plugin.app.vault.getMarkdownFiles().filter(isContentNote).sort((a,b)=>b.stat.ctime-a.stat.ctime||a.path.localeCompare(b.path)).slice(0,6);
    if(!files.length){this.containerEl.createEl('p',{text:'Seus próximos conteúdos aparecem aqui.',cls:'faculdade-facil-hint'});return;}
    const list=this.containerEl.createEl('ul',{cls:'faculdade-facil-recentes'});
    for(const file of files){
      const item=list.createEl('li');
      const link=item.createEl('a',{text:file.basename,cls:'internal-link',href:file.path});
      link.addEventListener('click',event=>{event.preventDefault();void this.plugin.app.workspace.openLinkText(file.path,'',event.ctrlKey||event.metaKey);});
      item.createEl('span',{text:this.plugin.targetForPath(file.path)?.name||'Para organizar',cls:'faculdade-facil-hint'});
    }
  }
}
function isContentNote(file){
  if(Object.values(ROOTS).some(root=>file.path.startsWith(root+'/')))return file.path.split('/').length>3&&!file.path.includes('/Arquivos/');
  return isInboxNote(file);
}
class AssignCourseModal extends Modal {
  constructor(plugin,file){super(plugin.app);this.plugin=plugin;this.file=file;this.course=null;this.busy=false;}
  onOpen(){
    this.setTitle('Escolher destino');this.modalEl.addClass('faculdade-facil-modal');
    this.contentEl.createEl('p',{text:this.file.basename,cls:'faculdade-facil-hint'});
    const form=this.contentEl.createEl('form');
    const label=form.createEl('label',{text:'Disciplina ou estudo independente'}),select=label.createEl('select');
    populateTargets(select,this.plugin,'Selecione um destino');
    const typeLabel=form.createEl('label',{text:'Organizar como'}),typeSelect=typeLabel.createEl('select');
    const refreshTypes=()=>{typeSelect.empty();typeSelect.createEl('option',{text:'Escolher automaticamente',value:''});for(const [key,value]of Object.entries(TYPES))if(allowedType(this.course,key))typeSelect.createEl('option',{text:value.label,value:key});};
    refreshTypes();
    select.required=true;select.addEventListener('change',()=>{this.course=this.plugin.targetBy(select.value);refreshTypes();});
    const error=form.createEl('p',{cls:'faculdade-facil-error',attr:{role:'alert'}});
    const actions=form.createDiv({cls:'faculdade-facil-actions'});
    const cancel=actions.createEl('button',{text:'Cancelar',attr:{type:'button'}});cancel.addEventListener('click',()=>this.close());
    const submit=actions.createEl('button',{text:'Guardar no destino',attr:{type:'submit'},cls:'mod-cta'});
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(!this.course||this.busy)return;
      this.busy=true;submit.disabled=true;cancel.disabled=true;select.disabled=true;typeSelect.disabled=true;submit.setText('Organizando…');
      try{await this.plugin.runExclusive(()=>this.plugin.assignCourse(this.file,this.course,typeSelect.value));this.busy=false;this.close();}
      catch(e){error.setText('Não foi possível organizar: '+e.message);this.busy=false;submit.disabled=false;cancel.disabled=false;select.disabled=false;typeSelect.disabled=false;submit.setText('Tentar novamente');}
    });select.focus();
  }
  close(){if(!this.busy)super.close();}
  onClose(){this.contentEl.empty();}
}

class CreateTargetModal extends Modal {
  constructor(plugin,kind){super(plugin.app);this.plugin=plugin;this.kind=kind;this.busy=false;}
  onOpen(){
    this.setTitle(this.kind==='disciplina'?'Nova disciplina':'Novo estudo independente');
    this.modalEl.addClass('faculdade-facil-modal');
    const form=this.contentEl.createEl('form');
    form.createEl('p',{text:'Cria a pasta, as subpastas e uma página para reunir seus conteúdos.',cls:'faculdade-facil-hint'});
    const label=form.createEl('label',{text:'Nome'}),input=label.createEl('input',{type:'text',placeholder:this.kind==='disciplina'?'Ex.: Banco de Dados':'Ex.: Git e GitHub'});
    input.required=true;input.maxLength=80;
    const destination=form.createEl('p',{cls:'faculdade-facil-destination'});
    const update=()=>destination.setText('Destino: '+ROOTS[this.kind]+(input.value.trim()?' → '+input.value.trim():''));
    input.addEventListener('input',update);update();
    const error=form.createEl('p',{cls:'faculdade-facil-error',attr:{role:'alert'}});
    const actions=form.createDiv({cls:'faculdade-facil-actions'});
    const cancel=actions.createEl('button',{text:'Cancelar',attr:{type:'button'}});cancel.addEventListener('click',()=>this.close());
    const submit=actions.createEl('button',{text:'Criar',attr:{type:'submit'},cls:'mod-cta'});
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(this.busy)return;
      this.busy=true;input.disabled=true;submit.disabled=true;cancel.disabled=true;error.setText('');submit.setText('Criando…');
      let page;
      try{page=await this.plugin.runExclusive(()=>this.plugin.createTarget(this.kind,input.value));}
      catch(e){error.setText(e.message);this.busy=false;input.disabled=false;submit.disabled=false;cancel.disabled=false;submit.setText('Tentar novamente');input.focus();return;}
      this.busy=false;this.close();new Notice('Criado: '+page.basename+'.');
      try{await this.app.workspace.getLeaf(false).openFile(page);}catch{new Notice('A página foi criada. Abra-a pela página inicial.');}
    });input.focus();
  }
  close(){if(!this.busy)super.close();}
  onClose(){this.contentEl.empty();}
}

class TargetList extends MarkdownRenderChild {
  constructor(el,plugin,kind){super(el);this.plugin=plugin;this.kind=kind;}
  onload(){this.render();for(const event of ['create','delete','rename'])this.registerEvent(this.plugin.app.vault.on(event,()=>this.render()));}
  render(){
    this.containerEl.empty();const targets=this.plugin.targets(this.kind);
    if(!targets.length){this.containerEl.createEl('p',{text:this.kind==='estudo'?'Use Novo estudo independente para criar seu primeiro tema.':'Use Nova disciplina para cadastrar uma matéria.',cls:'faculdade-facil-hint'});return;}
    const list=this.containerEl.createEl('ul');
    for(const target of targets){
      const path=target.path+'/'+target.name+'.md';
      const link=list.createEl('li').createEl('a',{text:target.name,cls:'internal-link',href:path});
      link.addEventListener('click',event=>{event.preventDefault();void this.plugin.app.workspace.openLinkText(path,'',event.ctrlKey||event.metaKey);});
    }
  }
}

class FaculdadeFacil extends Plugin {
  targets(kind){
    const targets=[];
    for(const [key,root]of Object.entries(ROOTS)){
      if(kind&&kind!==key)continue;
      const folder=this.app.vault.getAbstractFileByPath(root);
      if(!(folder instanceof TFolder))continue;
      for(const child of folder.children){
        if(!(child instanceof TFolder))continue;
        if(!(this.app.vault.getAbstractFileByPath(child.path+'/'+child.name+'.md') instanceof TFile))continue;
        targets.push({kind:key,name:child.name,path:child.path});
      }
    }
    return targets.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
  }
  targetBy(value,kind){
    if(!value)return null;
    const targets=this.targets(kind);
    const exact=targets.find(target=>target.path===value);if(exact)return exact;
    const matches=targets.filter(target=>fold(target.name)===fold(value));
    return matches.length===1?matches[0]:null;
  }
  targetForPath(path){return this.targets().find(target=>path.startsWith(target.path+'/'))||null;}
  validateTarget(target){
    const current=target&&this.targetBy(target.path);
    if(!current||current.kind!==target.kind)throw new Error('O destino não está mais disponível. Abra o formulário novamente.');
    return current;
  }
  async createTarget(kind,value){
    if(!Object.hasOwn(ROOTS,kind))throw new Error('Escolha disciplina ou estudo independente.');
    const name=String(value).normalize('NFC').trim();
    if(!name||name.startsWith('.')||name.length>80||safeName(name)!==name||/[`\r\n\t]/.test(name))throw new Error('Use até 80 caracteres, sem ponto inicial ou caracteres reservados como /, \\, :, # ou colchetes.');
    const root=ROOTS[kind],path=root+'/'+name;
    const existingRoot=this.app.vault.getAbstractFileByPath(root);
    if(existingRoot instanceof TFile)throw new Error('Há um arquivo no lugar da pasta '+root+'.');
    if(this.app.vault.getAbstractFileByPath(path)||existingRoot?.children.some(child=>fold(child.name)===fold(name)))throw new Error('Já existe uma pasta ou arquivo com esse nome em '+root+'.');
    const folders=kind==='disciplina'?['Anotações','Materiais','Materiais/Arquivos','Trabalhos e provas']:['Anotações','Práticas','Materiais','Materiais/Arquivos'];
    const sections=kind==='disciplina'?['Anotações','Materiais','Trabalhos e provas']:['Anotações','Práticas','Materiais'];
    const params=new URLSearchParams({acao:'conteudo',destino:path});
    let content='# '+name+'\n\n[[00 - Início|Voltar ao início]]\n\n[Adicionar conteúdo](obsidian://notae?'+params.toString()+')\n';
    for(const section of sections)content+='\n## '+section+'\n\n```query\npath:'+JSON.stringify(path+'/'+section+'/')+(section==='Materiais'?' -path:"/Arquivos/"':'')+'\n```\n';
    const created=[];
    try{
      if(!existingRoot)created.push(await this.app.vault.createFolder(root));
      created.push(await this.app.vault.createFolder(path));
      for(const folder of folders)created.push(await this.app.vault.createFolder(path+'/'+folder));
      return await this.app.vault.create(path+'/'+name+'.md',content);
    }catch(error){
      // Remove only empty folders created by this attempt; never existing content.
      for(const folder of created.reverse())if(folder instanceof TFolder&&!folder.children.length){try{await this.app.vault.delete(folder);}catch{new Notice('Uma pasta vazia permaneceu em '+folder.path+'.');}}
      throw error;
    }
  }
  handleAction(params){
    if(params.vault&&params.vault!==this.app.vault.getName()){new Notice('Este atalho pertence a outro vault.');return;}
    if(params.acao==='nova-disciplina'){new CreateTargetModal(this,'disciplina').open();return;}
    if(params.acao==='novo-estudo'){new CreateTargetModal(this,'estudo').open();return;}
    this.openCreate({material:params.acao==='material',course:params.disciplina,study:params.estudo,target:params.destino,type:params.tipo});
  }
  async onload(){
    this.work=Promise.resolve();this.timers=new Map();
    const addContentButton=this.addRibbonIcon('plus','Adicionar conteúdo',()=>this.openCreate());
    addContentButton.addClass('faculdade-facil-add-content');
    addContentButton.setAttribute('aria-label','Adicionar conteúdo');
    addContentButton.setAttribute('role','button');
    addContentButton.setAttribute('tabindex','0');
    this.registerDomEvent(addContentButton,'keydown',event=>{
      if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();this.openCreate();}
    });
    this.app.workspace.onLayoutReady(()=>addContentButton.parentElement?.prepend(addContentButton));
    this.addCommand({id:'adicionar-conteudo',name:'Adicionar conteúdo',callback:()=>this.openCreate()});
    this.addCommand({id:'abrir-inicio',name:'Abrir início dos estudos',callback:()=>{void this.openHome().catch(error=>new Notice(error.message));}});
    this.addCommand({id:'nova-disciplina',name:'Nova disciplina',callback:()=>new CreateTargetModal(this,'disciplina').open()});
    this.addCommand({id:'novo-estudo',name:'Novo estudo independente',callback:()=>new CreateTargetModal(this,'estudo').open()});
    this.addCommand({id:'nova-anotacao',name:'Nova anotação',callback:()=>this.openCreate(),hotkeys:[{modifiers:['Mod','Shift'],key:'N'}]});
    this.addCommand({id:'adicionar-material',name:'Adicionar material',callback:()=>this.openCreate({material:true})});
    this.addCommand({id:'escolher-disciplina',name:'Escolher destino desta nota',checkCallback:checking=>{
      const file=this.app.workspace.getActiveFile();const eligible=isInboxNote(file);
      if(eligible&&!checking)new AssignCourseModal(this,file).open();return eligible;
    }});
    this.registerEvent(this.app.workspace.on('file-menu',(menu,file)=>{
      if(isInboxNote(file))menu.addItem(item=>item.setTitle('Escolher destino').setIcon('folder-input').onClick(()=>new AssignCourseModal(this,file).open()));
    }));
    this.registerMarkdownCodeBlockProcessor('faculdade-recentes',(_source,el,ctx)=>ctx.addChild(new RecentContents(el,this)));
    this.registerMarkdownCodeBlockProcessor('faculdade-disciplinas',(_source,el,ctx)=>ctx.addChild(new TargetList(el,this,'disciplina')));
    this.registerMarkdownCodeBlockProcessor('faculdade-estudos',(_source,el,ctx)=>ctx.addChild(new TargetList(el,this,'estudo')));
    this.addCommand({id:'organizar-nota',name:'Organizar a nota pelo título',callback:()=>{
      const file=this.app.workspace.getActiveFile();if(file)void this.runExclusive(()=>this.routeNote(file,true)).catch(error=>new Notice(error.message));
    }});
    this.registerObsidianProtocolHandler('notae',params=>this.handleAction(params));
    this.registerMarkdownPostProcessor(el=>{
      for(const link of el.querySelectorAll('a[href^="obsidian://notae?"]')){
        link.addEventListener('click',event=>{
          event.preventDefault();event.stopPropagation();
          const params=new URL(link.getAttribute('href')).searchParams;
          this.handleAction(Object.fromEntries(params));
        });
      }
    });
    this.registerEvent(this.app.vault.on('create',file=>this.queueRouting(file)));
    this.registerEvent(this.app.vault.on('rename',file=>this.queueRouting(file)));
    this.registerEvent(this.app.metadataCache.on('changed',file=>this.queueAttachments(file)));
    this.app.workspace.onLayoutReady(()=>{
      for(const file of this.app.vault.getMarkdownFiles())if(file.path.startsWith('Para organizar/'))this.queueRouting(file);
      if(!this.app.workspace.getActiveFile())void this.openHome().catch(error=>new Notice(error.message));
    });
  }
  async openHome(){
    const home=this.app.vault.getAbstractFileByPath('00 - Início.md');
    if(!(home instanceof TFile))throw new Error('Abra a pasta vault do pacote Notaê, que contém 00 - Início.md e Modelos.');
    await this.app.workspace.getLeaf(false).openFile(home);
  }
  onunload(){for(const timer of this.timers.values())window.clearTimeout(timer);this.timers.clear();}
  runExclusive(task){const result=this.work.then(task);this.work=result.catch(()=>{});return result;}
  openCreate(options={}){new CreateNoteModal(this,options).open();}
  defer(key,task){
    if(this.timers.has(key))window.clearTimeout(this.timers.get(key));
    this.timers.set(key,window.setTimeout(()=>{
      this.timers.delete(key);void this.runExclusive(task).catch(error=>new Notice('Notaê: '+error.message));
    },700));
  }
  queueRouting(file){
    if(!(file instanceof TFile))return;
    if(isInboxNote(file))this.defer('note:'+file.path,()=>this.routeNote(file));
    if(file.path.startsWith('Para organizar/Arquivos/')){
      const active=this.app.workspace.getActiveFile();if(active)this.queueAttachments(active);
    }
  }
  queueAttachments(file){
    if(!(file instanceof TFile)||file.extension!=='md'||!this.targetForPath(file.path))return;
    this.defer('attachments:'+file.path,()=>this.organizeAttachments(file));
  }
  async ensureFolder(folder){
    const parts=normalizePath(folder).split('/');let current='';
    for(const part of parts){current=current?current+'/'+part:part;
      const entry=this.app.vault.getAbstractFileByPath(current);
      if(!entry)await this.app.vault.createFolder(current);
      else if(entry instanceof TFile)throw new Error('Há um arquivo no lugar da pasta '+current+'.');
    }
  }
  uniquePath(folder,name){
    const split=name.lastIndexOf('.');const stem=split>0?name.slice(0,split):name,ext=split>0?name.slice(split):'';
    let candidate=normalizePath(folder+'/'+name),i=2;
    while(this.app.vault.getAbstractFileByPath(candidate))candidate=normalizePath(folder+'/'+stem+' ('+(i++)+')'+ext);
    return candidate;
  }
  async readTemplate(type,title,course){
    const template=this.app.vault.getAbstractFileByPath('Modelos/'+TYPES[type].template+'.md');
    if(!(template instanceof TFile))throw new Error('O modelo '+TYPES[type].template+' não foi encontrado.');
    const source=await this.app.vault.cachedRead(template);
    const hub=course?course.path+'/'+course.name:'Para organizar/Caixa de entrada';
    return source.replaceAll('{{title}}',()=>title).replaceAll('{{date:DD/MM/YYYY}}',localDate()).replaceAll('{{date}}',localDate())+'\n[['+hub+'|'+(course?course.name:'Para organizar')+']]\n';
  }
  async createStudyNote(course,type,title,files=[],body=''){
    if(course!==null)course=this.validateTarget(course);
    if(!allowedType(course,type))throw new Error('Escolha um tipo de conteúdo válido para o destino.');
    title=safeName(title);
    const folder=course?course.path+'/'+contentFolder(course,type):'Para organizar';
    await this.ensureFolder(folder);
    const notePath=this.uniquePath(folder,title+'.md');
    let content=await this.readTemplate(type,title,course);
    if(!content.includes('## Minhas observações'))content+='\n## Minhas observações\n';
    const input=body.trim();
    if(input)content=content.replace('## Minhas observações',()=>'## Minhas observações\n\n'+input);
    const created=[];const attachments=[];
    try{
      if(files.length){
        const attachmentFolder=course?course.path+'/Materiais/Arquivos':'Para organizar/Arquivos';
        await this.ensureFolder(attachmentFolder);
        for(const upload of files){
          const name=this.safeUploadName(upload.name);
          const bytes=await upload.arrayBuffer();
          const existing=this.app.vault.getAbstractFileByPath(attachmentFolder+'/'+name);
          let file;
          if(existing instanceof TFile&&equivalentBuffers(bytes,await this.app.vault.readBinary(existing)))file=existing;
          else{
            const uploadPath=this.uniquePath(attachmentFolder,name);
            file=await this.app.vault.createBinary(uploadPath,bytes);created.push(file);
          }
          if(!attachments.some(a=>a.path===file.path))attachments.push(file);
        }
        const refs=attachments.map(file=>{
          const link=this.app.fileManager.generateMarkdownLink(file,notePath);
          return EMBED_EXTENSIONS.has(file.extension.toLowerCase())?'!'+link:link;
        }).join('\n\n');
        content=content.replace('## Minhas observações',()=>'## Minhas observações\n\n'+refs);
      }
      return await this.app.vault.create(notePath,content);
    }catch(error){
      // Only the new copies from this failed import are eligible for rollback.
      // Existing files and the external originals are never removed.
      for(const file of created){try{await this.app.vault.trash(file,false);}catch{new Notice('Uma cópia permaneceu em Materiais/Arquivos: '+file.name);}}
      throw error;
    }
  }
  safeUploadName(original){
    const i=String(original).lastIndexOf('.');
    if(i>0){const extension=String(original).slice(i+1).replace(/[^a-zA-Z0-9]/g,'').slice(0,16);if(extension)return safeName(String(original).slice(0,i))+'.'+extension;}
    return safeName(original);
  }
  async assignCourse(file,course,type=''){
    if(!isInboxNote(file))throw new Error('Esta nota já foi organizada ou é um anexo.');
    course=this.validateTarget(course);
    const source=await this.app.vault.read(file);
    const parsed=parseTitle(file.basename,value=>this.targetBy(value));
    const detected=parsed?.type||(/## Minha tentativa/.test(source)?'exercicio':/## Orientações/.test(source)?'trabalho':(/!?\[\[|https?:\/\//.test(source.replace(/\[\[(?:Para organizar\/Caixa de entrada|00 - Início)[^\]]*\]\]/g,''))?'material':'aula'));
    const kind=type||(allowedType(course,detected)?detected:'material');
    if(!allowedType(course,kind))throw new Error('Escolha um tipo de conteúdo válido para o destino.');
    const folder=course.path+'/'+contentFolder(course,kind);
    await this.ensureFolder(folder);
    await this.app.fileManager.renameFile(file,this.uniquePath(folder,file.name));
    await this.app.vault.process(file,current=>{
      const link='[['+course.path+'/'+course.name+'|'+course.name+']]';
      return current.includes('[[Para organizar/Caixa de entrada|Para organizar]]')?current.replaceAll('[[Para organizar/Caixa de entrada|Para organizar]]',()=>link):current.includes(link)?current:current+'\n\n'+link+'\n';
    });
    await this.organizeAttachments(file);
    new Notice('Conteúdo guardado em '+course.name+'.');
  }
  async routeNote(file,explicit=false){
    if(!(file instanceof TFile)||file.extension!=='md')return false;
    if(!isInboxNote(file)){if(explicit)new Notice('A organização pelo título atua nas notas de Para organizar.');return false;}
    const parsed=parseTitle(file.basename,value=>this.targetBy(value));
    if(!parsed){if(explicit)new Notice('Use o nome completo de um destino cadastrado: Nome do estudo - Aula - Assunto. Nomes repetidos devem ser escolhidos pelo formulário.');return false;}
    const {course,type}=parsed;
    if(!allowedType(course,type)){if(explicit)new Notice('Para estudos independentes, use anotação, exercício ou material.');return false;}
    const title=file.basename;
    const template=await this.readTemplate(type,title,course);
    await this.app.vault.process(file,current=>current.trim()?current:template);
    await this.assignCourse(file,course,type);
    return true;
  }
  async organizeAttachments(source){
    const course=this.targetForPath(source.path);if(!course)return;
    const cached=this.app.metadataCache.getFileCache(source);
    const refs=[...(cached?.embeds||[]),...(cached?.links||[])];
    const pending=new Map();
    for(const ref of refs){
      const attachment=this.app.metadataCache.getFirstLinkpathDest(ref.link,source.path);
      if(attachment instanceof TFile&&attachment.path.startsWith('Para organizar/Arquivos/'))pending.set(attachment.path,attachment);
    }
    if(!pending.size)return;
    const folder=course.path+'/Materiais/Arquivos';await this.ensureFolder(folder);
    for(const attachment of pending.values())await this.app.fileManager.renameFile(attachment,this.uniquePath(folder,attachment.name));
  }
}
module.exports=FaculdadeFacil;
module.exports._test={TYPES,parseTitle,safeName,typeBy,isContentNote,isInboxNote,contentFolder,allowedType,CreateNoteModal,CreateTargetModal,AssignCourseModal,TargetList,RecentContents};

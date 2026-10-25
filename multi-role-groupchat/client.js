window.__ModuleLoader__.load({
  id: '@local/multi-role-groupchat',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useRef, useMemo, useCallback } = React;
    const useSyncExternalStore = React.useSyncExternalStore;

    const NS = 'groupchat';
    const PANEL_ID = 'groupchat';
    const SELECTED_KEY = 'dsh.groupchat.selected.v1';

    const CSS = `
.mgc-page{position:relative;box-sizing:border-box;display:flex;flex-direction:column;width:100%;height:100%;min-height:0;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font-size:14px;line-height:1.6;overflow:hidden}
.mgc-page *,.mgc-page *:before,.mgc-page *:after{box-sizing:border-box}
.mgc-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:26px clamp(20px,4vw,40px) 14px;border-bottom:.5px solid var(--dsw-alias-border-l1);flex:none}
[data-platform=darwin] .mgc-header{padding-top:calc(26px + var(--dsh-frame-top-clearance,0px))}
.mgc-headMain{min-width:0;display:flex;flex-direction:column;gap:4px}
.mgc-titleRow{display:flex;align-items:center;gap:6px;min-width:0}
.mgc-groupBtn{display:inline-flex;align-items:center;gap:5px;min-width:0;max-width:100%;border:0;background:transparent;color:inherit;font:inherit;font-size:20px;font-weight:600;line-height:28px;padding:0;cursor:pointer;border-radius:8px}
.mgc-groupBtn:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent)}
.mgc-groupName{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mgc-chevron{flex:none;color:var(--dsw-alias-label-secondary)}
.mgc-sub{display:flex;align-items:center;gap:8px;flex-wrap:wrap;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:20px}
.mgc-dot{width:3px;height:3px;border-radius:50%;background:var(--dsw-alias-label-secondary);flex:none}
.mgc-headActions{display:flex;align-items:center;gap:8px;flex:none;padding-top:2px}
.mgc-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:30px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l2);border-radius:10px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;cursor:pointer;white-space:nowrap;transition:background .12s,border-color .12s,opacity .12s}
.mgc-btn:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent)}
.mgc-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.mgc-btn:disabled{opacity:.45;cursor:default}
.mgc-btnPrimary{background:var(--dsw-alias-brand-primary);border-color:transparent;color:#fff}
.mgc-btnPrimary:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-brand-primary) 86%,#000)}
.mgc-btnDanger{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 40%,transparent)}
.mgc-iconBtn{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;flex:none}
.mgc-iconBtn:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-label-primary) 7%,transparent);color:var(--dsw-alias-label-primary)}
.mgc-iconBtn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.mgc-iconBtn:disabled{opacity:.4;cursor:default}
.mgc-threadWrap{flex:1;min-height:0;overflow:auto;scrollbar-gutter:stable}
.mgc-thread{max-width:840px;margin:0 auto;padding:20px clamp(16px,3vw,36px) 36px}
.mgc-threadEmpty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:240px;color:var(--dsw-alias-label-secondary);font-size:13px;text-align:center;padding:40px 20px}
.mgc-threadEmptyGlyph{opacity:.55}
.mgc-msg{display:flex;gap:10px;padding:7px 0;position:relative}
.mgc-msgCont{padding-top:1px}
.mgc-msgCont .mgc-av{visibility:hidden}
.mgc-av{display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;flex:none;margin-top:1px;color:#fff;font-size:12px;font-weight:600;line-height:1;letter-spacing:.02em;user-select:none}
.mgc-avSm{width:26px;height:26px;font-size:11px}
.mgc-avOwner{background:var(--dsw-alias-brand-primary)}
.mgc-body{flex:1;min-width:0}
.mgc-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-height:20px;font-size:12px;line-height:20px}
.mgc-name{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary)}
.mgc-time{color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
.mgc-tag{display:inline-flex;align-items:center;gap:3px;padding:0 6px;height:18px;border-radius:9px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent);color:var(--dsw-alias-label-secondary);font-size:10px;line-height:18px;font-weight:500}
.mgc-tagPin{color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent)}
.mgc-tagWarn{color:var(--dsw-alias-state-warn-primary);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 14%,transparent)}
.mgc-text{margin:1px 0 0;white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:1.72}
.mgc-mention{color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent);border-radius:4px;padding:0 2px}
.mgc-usage{color:var(--dsw-alias-label-secondary);font-size:11px;font-variant-numeric:tabular-nums;opacity:.85}
.mgc-actions{display:flex;align-items:center;gap:2px;margin-top:3px;opacity:0;transition:opacity .12s}
.mgc-msg:hover .mgc-actions,.mgc-msg:focus-within .mgc-actions{opacity:1}
@media (hover:none){.mgc-actions{opacity:1}}
.mgc-action{display:inline-flex;align-items:center;gap:4px;height:24px;padding:0 7px;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;cursor:pointer}
.mgc-action:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-label-primary) 7%,transparent);color:var(--dsw-alias-label-primary)}
.mgc-action:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.mgc-action:disabled{opacity:.4;cursor:default}
.mgc-typing{display:flex;align-items:center;gap:8px;padding:8px 0 4px 40px;color:var(--dsw-alias-label-secondary);font-size:13px}
.mgc-dots{display:inline-flex;align-items:center;gap:3px}
.mgc-dots i{display:block;width:4px;height:4px;border-radius:50%;background:currentColor;opacity:.35;animation:mgcBlink 1.1s infinite ease-in-out}
.mgc-dots i:nth-child(2){animation-delay:.15s}
.mgc-dots i:nth-child(3){animation-delay:.3s}
@keyframes mgcBlink{0%,80%,100%{opacity:.25;transform:translateY(0)}40%{opacity:.9;transform:translateY(-1px)}}
.mgc-noticeRow{display:flex;justify-content:center;padding:10px 0}
.mgc-notice{display:inline-flex;align-items:flex-start;gap:7px;max-width:100%;padding:6px 12px;border-radius:10px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 5%,transparent);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:19px;text-align:left}
.mgc-noticeWarn{color:var(--dsw-alias-state-warn-primary);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 10%,transparent)}
.mgc-foldBar{display:flex;align-items:center;justify-content:center;gap:8px;padding:8px 0;margin:6px 0}
.mgc-foldBtn{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l1);border-radius:13px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;cursor:pointer}
.mgc-foldBtn:hover{color:var(--dsw-alias-label-primary);background:color-mix(in srgb,var(--dsw-alias-label-primary) 5%,transparent)}
.mgc-foldMsg{opacity:.5}
.mgc-foldMsg:hover,.mgc-foldMsg:focus-within{opacity:.8}
.mgc-composer{flex:none;border-top:.5px solid var(--dsw-alias-border-l1);padding:10px clamp(16px,3vw,36px) 16px;background:var(--dsw-alias-bg-base)}
.mgc-composerInner{max-width:840px;margin:0 auto}
.mgc-banner{display:flex;align-items:flex-start;gap:8px;margin:0 0 8px;padding:7px 10px;border-radius:9px;font-size:12px;line-height:18px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 9%,transparent);color:var(--dsw-alias-state-error-primary)}
.mgc-bannerWarn{background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 10%,transparent);color:var(--dsw-alias-state-warn-primary)}
.mgc-banner button{margin-left:auto;flex:none}
.mgc-inputWrap{display:flex;flex-direction:column;gap:2px;border:.5px solid var(--dsw-alias-border-l2);border-radius:16px;background:var(--dsw-alias-bg-layer-1);padding:8px 8px 6px 10px;transition:border-color .15s}
.mgc-inputWrap:focus-within{border-color:var(--dsw-alias-brand-primary)}
.mgc-inputWrap[data-disabled=true]{opacity:.72}
.mgc-textarea{display:block;width:100%;min-height:46px;max-height:180px;padding:4px 2px;border:0;background:transparent;color:inherit;font:inherit;font-size:14px;line-height:1.6;resize:none;outline:none;overflow:auto}
.mgc-textarea::placeholder{color:var(--dsw-alias-label-secondary)}
.mgc-composerBar{display:flex;align-items:center;gap:4px;min-height:28px}
.mgc-send{display:inline-flex;align-items:center;justify-content:center;height:30px;padding:0 14px;margin-left:auto;border:0;border-radius:15px;background:var(--dsw-alias-brand-primary);color:#fff;font:inherit;font-size:13px;cursor:pointer}
.mgc-send:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-brand-primary) 86%,#000)}
.mgc-send:disabled{opacity:.4;cursor:default}
.mgc-stop{color:var(--dsw-alias-state-error-primary)}
.mgc-count{color:var(--dsw-alias-label-secondary);font-size:11px;font-variant-numeric:tabular-nums;margin-left:6px}
.mgc-composerHint{min-height:16px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px;padding:4px 2px 0;display:flex;align-items:center;gap:6px}
.mgc-popWrap{position:relative;display:inline-flex}
.mgc-menu{position:absolute;top:calc(100% + 6px);left:0;z-index:40;min-width:220px;max-width:min(320px,calc(100vw - 32px));max-height:320px;overflow:auto;padding:5px;border:.5px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-overlay);box-shadow:0 12px 32px rgba(0,0,0,.18)}
.mgc-menuUp{top:auto;bottom:calc(100% + 6px)}
.mgc-menuRight{left:auto;right:0}
.mgc-menuRow{display:flex;align-items:center;gap:8px;width:100%;padding:7px 9px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;text-align:left;cursor:pointer}
.mgc-menuRow:hover,.mgc-menuRow:focus-visible{background:color-mix(in srgb,var(--dsw-alias-label-primary) 7%,transparent);outline:none}
.mgc-menuRow small{color:var(--dsw-alias-label-secondary);font-size:11px}
.mgc-menuHead{padding:6px 9px 4px;color:var(--dsw-alias-label-secondary);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em}
.mgc-menuSep{height:.5px;background:var(--dsw-alias-border-l1);margin:4px 6px}
.mgc-backdrop{position:absolute;inset:0;z-index:20;background:rgba(0,0,0,.28)}
.mgc-drawer{position:absolute;top:0;right:0;bottom:0;z-index:21;display:flex;flex-direction:column;width:min(560px,100%);background:var(--dsw-alias-bg-layer-1);border-left:.5px solid var(--dsw-alias-border-l2);box-shadow:-16px 0 40px rgba(0,0,0,.18)}
.mgc-drawerHead{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 18px 10px;flex:none}
.mgc-drawerTitle{margin:0;font-size:16px;font-weight:600;line-height:24px}
.mgc-tabs{display:flex;gap:4px;padding:0 14px;border-bottom:.5px solid var(--dsw-alias-border-l1);flex:none}
.mgc-tab{position:relative;padding:8px 10px 10px;border:0;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;cursor:pointer}
.mgc-tab:hover{color:var(--dsw-alias-label-primary)}
.mgc-tab[aria-selected=true]{color:var(--dsw-alias-label-primary);font-weight:600}
.mgc-tab[aria-selected=true]:after{content:"";position:absolute;left:8px;right:8px;bottom:-1px;height:2px;border-radius:2px;background:var(--dsw-alias-brand-primary)}
.mgc-tab:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.mgc-drawerBody{flex:1;min-height:0;overflow:auto;padding:16px 18px 32px;scrollbar-gutter:stable}
.mgc-field{display:flex;flex-direction:column;gap:5px;margin-bottom:14px}
.mgc-label{font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary)}
.mgc-hint{font-size:11px;line-height:17px;color:var(--dsw-alias-label-secondary)}
.mgc-input,.mgc-select,.mgc-textarea2{display:block;width:100%;border:.5px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;padding:7px 10px;outline:none}
.mgc-input:focus,.mgc-select:focus,.mgc-textarea2:focus{border-color:var(--dsw-alias-brand-primary)}
.mgc-input:disabled,.mgc-textarea2:disabled,.mgc-select:disabled{opacity:.55}
.mgc-textarea2{resize:vertical;min-height:96px;line-height:1.65}
.mgc-textareaCore{min-height:120px}
.mgc-row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.mgc-row3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.mgc-check{display:flex;align-items:center;gap:8px;font-size:13px;line-height:20px;cursor:pointer;user-select:none}
.mgc-check input{width:15px;height:15px;accent-color:var(--dsw-alias-brand-primary);margin:0}
.mgc-error{color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px;white-space:pre-wrap;margin:0 0 10px}
.mgc-success{color:var(--dsw-alias-state-success-primary);font-size:12px;line-height:18px;margin:0 0 10px}
.mgc-warnText{color:var(--dsw-alias-state-warn-primary);font-size:11px;line-height:17px}
.mgc-memberList{display:flex;flex-direction:column;gap:8px}
.mgc-memberRow{display:flex;align-items:center;gap:10px;width:100%;padding:9px 10px;border:.5px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-base);color:inherit;font:inherit;text-align:left;cursor:pointer}
.mgc-memberRow:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 4%,transparent)}
.mgc-memberRow[data-active=true]{border-color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 7%,transparent)}
.mgc-memberRow:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.mgc-memberText{min-width:0;flex:1;display:flex;flex-direction:column}
.mgc-memberName{font-size:13px;font-weight:600;line-height:20px}
.mgc-memberOneLiner{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:17px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mgc-card{border:.5px solid var(--dsw-alias-border-l1);border-radius:14px;padding:14px;margin-bottom:12px;background:var(--dsw-alias-bg-layer-1)}
.mgc-cardHead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
.mgc-cardTitle{margin:0;font-size:13px;font-weight:600;line-height:20px}
.mgc-formActions{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-top:6px}
.mgc-formStatus{margin-right:auto;font-size:11px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.mgc-onboarding{box-sizing:border-box;width:100%;height:100%;overflow:auto;padding:clamp(28px,7vh,72px) clamp(20px,4vw,40px) 56px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}
.mgc-onboardingInner{max-width:780px;margin:0 auto}
.mgc-h1{margin:0 0 6px;font-size:22px;font-weight:600;line-height:30px}
.mgc-p{margin:0 0 22px;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.75}
.mgc-memberDraft{position:relative}
.mgc-draftHead{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}
.mgc-draftTitle{font-size:13px;font-weight:600}
.mgc-settingsPage{box-sizing:border-box;width:100%;height:100%;overflow:auto;padding:26px clamp(20px,4vw,40px) 56px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}
.mgc-settingsInner{max-width:860px;margin:0 auto}
.mgc-section{border:.5px solid var(--dsw-alias-border-l1);border-radius:14px;padding:16px;margin-bottom:16px;background:var(--dsw-alias-bg-layer-1)}
.mgc-sectionHead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
.mgc-sectionTitle{margin:0;font-size:14px;font-weight:600;line-height:22px}
.mgc-emptyState{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;min-height:320px;padding:40px 20px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:13px}
.mgc-emptyState h2{margin:0 0 2px;font-size:16px;font-weight:600;color:var(--dsw-alias-label-primary)}
.mgc-emptyState p{margin:0;max-width:420px;line-height:1.7}
.mgc-groupList{display:flex;flex-direction:column;gap:6px}
.mgc-groupRow{display:flex;align-items:center;gap:10px;width:100%;padding:9px 11px;border:.5px solid transparent;border-radius:11px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}
.mgc-groupRow:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 5%,transparent)}
.mgc-groupRow[data-active=true]{border-color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 6%,transparent)}
.mgc-groupRow:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.mgc-groupText{flex:1;min-width:0;display:flex;flex-direction:column}
.mgc-groupNameSm{font-size:13px;font-weight:600;line-height:20px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mgc-groupMeta{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:17px}
.mgc-budgetBar{height:3px;border-radius:2px;overflow:hidden;background:color-mix(in srgb,var(--dsw-alias-label-primary) 10%,transparent);margin-top:6px;max-width:260px}
.mgc-budgetFill{height:100%;border-radius:2px;background:var(--dsw-alias-brand-primary)}
.mgc-budgetFill[data-over=true]{background:var(--dsw-alias-state-error-primary)}
.mgc-loading{display:flex;align-items:center;justify-content:center;height:100%;color:var(--dsw-alias-label-secondary);font-size:13px}
.mgc-spin{width:14px;height:14px;border:2px solid color-mix(in srgb,var(--dsw-alias-brand-primary) 25%,transparent);border-top-color:var(--dsw-alias-brand-primary);border-radius:50%;animation:mgcSpin .8s linear infinite}
@keyframes mgcSpin{to{transform:rotate(360deg)}}
.mgc-tableHead{display:flex;align-items:center;gap:8px;padding:4px 2px 10px;color:var(--dsw-alias-label-secondary);font-size:11px}
.mgc-pathText{word-break:break-all;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:17px}
.mgc-bannerSlot{max-width:840px;margin:0 auto;padding:8px clamp(16px,3vw,36px) 0}
.mgc-createEmbed{width:100%}
.mgc-typingLabel{color:var(--dsw-alias-label-secondary);font-size:12px}
.mgc-menuRow:disabled{opacity:.45;cursor:default}
@media (max-width:720px){
.mgc-header{flex-direction:column;gap:10px}
.mgc-headActions{width:100%;justify-content:flex-end}
.mgc-drawer{width:100%}
.mgc-row2,.mgc-row3{grid-template-columns:1fr}
.mgc-thread{padding-left:14px;padding-right:14px}
.mgc-bannerSlot{padding-left:14px;padding-right:14px}
}
`;

    const zh = {
      'panel': '群聊',
      'loading': '加载中…',
      'retry': '重试',
      'actionFailed': '操作失败',
      'loadFailed': '加载失败',
      'empty.title': '还没有群聊',
      'empty.desc': '建一个群，拉两三个 AI 成员，开始聊。消息默认全群可见，谁都可以用 @ 把话交给别人。',
      'empty.create': '新建群聊',
      'create.title': '新建群聊',
      'create.desc': '先给群一个名字、一点气氛，再放两三个成员。核心设定会每轮注入；其余随时可改。',
      'create.name': '群名',
      'create.namePlaceholder': '例如：旧城书店的晚上',
      'create.brief': '群简介',
      'create.briefPlaceholder': '场景、气氛、开场前提。（可空）',
      'create.members': '成员（2–3 个）',
      'create.memberN': '成员 {n}',
      'create.memberName': '显示名',
      'create.memberNamePlaceholder': '例如：林晚',
      'create.memberOneLiner': '一句话档案',
      'create.memberOneLinerPlaceholder': '旧城书店店主，说话短，不爱解释',
      'create.memberCore': '核心设定',
      'create.memberCorePlaceholder': '身份、说话方式、与在场者的关系、在意的事、底线、秘密（不主动说，被逼问会露破绽）。',
      'create.coreHint': '每轮都会注入，建议 ≤ 4000 字。',
      'create.addMember': '再加一个成员',
      'create.remove': '移除',
      'create.submit': '创建群聊',
      'create.submitting': '创建中…',
      'create.cancel': '取消',
      'create.back': '返回群聊',
      'create.hint': '创建后可在「管理」里补全扩展设定、模型覆盖与预算。',
      'header.members': '成员 {n}',
      'header.tokens': '{n} tokens',
      'header.pinned': '{n} 钉住',
      'header.budget': '预算 {used}/{max}',
      'header.manage': '管理',
      'header.export': '导出',
      'header.newGroup': '新建群聊',
      'header.switchGroup': '切换群聊',
      'header.generating': '{name}正在输入…',
      'header.stop': '停止',
      'header.defaultModel': '默认模型：{model}',
      'messages.owner': '群主',
      'messages.pin': '钉住',
      'messages.unpin': '取消钉住',
      'messages.copy': '复制',
      'messages.copied': '已复制',
      'messages.rewrite': '重写',
      'messages.rewriting': '重写中…',
      'messages.usageTitle': '输入 {input} · 输出 {output} · 缓存读 {cacheRead} · 缓存写 {cacheWrite}',
      'messages.folded': '已折叠 {n} 条早期消息（钉住消息保留）',
      'messages.showFolded': '查看',
      'messages.hideFolded': '收起',
      'messages.foldedTag': '已折叠',
      'messages.typing': '{name}正在输入',
      'messages.stoppedTag': '已停止，未保存',
      'messages.rewrittenTag': '重写中…',
      'messages.empty': '还没有消息。说点什么，或者在输入框里 @ 一位成员。',
      'messages.emptyHint': '只有 @ 会改变接话对象；不写 @ 时按轮转接话。',
      'composer.placeholder': '说点什么…（Enter 发送，Shift+Enter 换行）',
      'composer.send': '发送',
      'composer.mention': '选择成员',
      'composer.owner': '群主',
      'composer.busy': '生成中，输入框已暂停。',
      'composer.stopping': '正在停止…',
      'composer.disabled': '生成中…',
      'composer.count': '{n}/8000',
      'manage.title': '群聊管理',
      'manage.close': '关闭',
      'manage.tab.group': '群设置',
      'manage.tab.members': '成员',
      'manage.tab.export': '导出',
      'common.save': '保存',
      'common.saving': '保存中…',
      'common.saved': '已保存',
      'common.cancel': '取消',
      'common.delete': '移除',
      'common.none': '（无）',
      'common.add': '添加',
      'group.name': '群名',
      'group.brief': '群简介',
      'group.policyTitle': '接话规则',
      'group.replyMode': '接话模式',
      'group.replyModeValue': '@ 优先，其次轮转',
      'group.maxMentionReplies': '一条用户消息最多回应几个被 @ 的成员',
      'group.maxHandoffDepth': '接话跳数上限',
      'group.maxHistory': '进入 prompt 的最近消息数',
      'group.maxPinned': '钉住上限',
      'group.maxReplyChars': '单条回应字数上限',
      'group.modelTitle': '模型',
      'group.modelInherit': '跟随宿主默认模型',
      'group.modelProvider': 'Provider',
      'group.modelId': 'Model',
      'group.budgetTitle': '预算',
      'group.maxInputTokens': '输入 token 上限',
      'group.maxOutputTokens': '输出 token 上限',
      'group.dataDir': '数据目录',
      'group.defaultModel': '宿主默认：{model}',
      'group.noDefaultModel': '宿主还没有选择默认模型',
      'group.policyHint': '保存后立即生效；已生成的消息不受影响。',
      'group.budgetHint': '累计用量达到上限后停止生成，并写入一条提示。设为 0 表示不限制。',
      'group.modelHint': '群级覆盖留空时使用宿主默认；成员还可以再单独覆盖。',
      'members.title': '成员',
      'members.add': '新增成员',
      'members.editing': '编辑 {name}',
      'members.new': '新成员',
      'members.name': '显示名（@ 用，≤ 16 字符）',
      'members.oneLiner': '公开档案 · 一句话',
      'members.relations': '公开关系',
      'members.relationWith': '与 {name}',
      'members.core': '核心设定（每轮注入）',
      'members.extended': '扩展设定（可选）',
      'members.extendedEnabled': '启用扩展设定（仅开启时注入）',
      'members.coreCount': '{n} / 建议 4000',
      'members.extendedCount': '{n} / 建议 8000',
      'members.overLimit': '超出建议长度 {n} 字：仍会保存，但会挤占上下文。',
      'members.modelTitle': '模型覆盖',
      'members.modelInherit': '跟随群/宿主默认',
      'members.save': '保存成员',
      'members.addSave': '添加成员',
      'members.atLeastTwo': '群里至少需要 2 个成员。',
      'members.empty': '还没有成员。',
      'members.modelValue': '当前：{model}',
      'export.includeHistory': '包含历史版本（被重写掉的旧消息）',
      'export.generate': '生成 Markdown',
      'export.generating': '生成中…',
      'export.empty': '生成后会在这里预览，同时写入群的 export/script.md。',
      'export.copy': '复制',
      'export.download': '下载',
      'export.path': '已写入：{path}',
      'export.filename': '群聊记录.md',
      'export.failed': '导出失败',
      'settings.title': '群聊',
      'settings.description': '管理群、成员设定、模型与预算。聊天在左侧「群聊」面板里。',
      'settings.open': '打开群聊面板',
      'settings.groups': '群列表',
      'settings.new': '新建群聊',
      'settings.empty': '还没有群聊，先创建一个。',
      'settings.hint': '设定、钉住与 token 统计都会立即同步到群聊面板。',
      'errors.busy': '正在生成，请先停止。',
      'errors.rewriteLatest': '只能重写最新一条有效成员回应。',
      'errors.copy': '复制失败',
      'errors.name': '群名不能为空。',
      'errors.members': '请填写 2–3 个成员的名字。',
    };

    const en = {
      'panel': 'Group chat',
      'loading': 'Loading…',
      'retry': 'Retry',
      'actionFailed': 'Action failed',
      'loadFailed': 'Could not load',
      'empty.title': 'No group yet',
      'empty.desc': 'Create a group, add two or three AI members, and start talking. Messages are visible to the whole group; anyone can hand the turn over with @.',
      'empty.create': 'New group',
      'create.title': 'New group',
      'create.desc': 'Give the group a name and a premise, then add two or three members. Core settings are injected every turn; everything stays editable.',
      'create.name': 'Group name',
      'create.namePlaceholder': 'e.g. An evening at the old-town bookshop',
      'create.brief': 'Brief',
      'create.briefPlaceholder': 'Scene, mood, premise. Optional.',
      'create.members': 'Members (2–3)',
      'create.memberN': 'Member {n}',
      'create.memberName': 'Display name',
      'create.memberNamePlaceholder': 'e.g. Lin Wan',
      'create.memberOneLiner': 'Public one-liner',
      'create.memberOneLinerPlaceholder': 'Runs the old-town bookshop. Short replies, no explanations.',
      'create.memberCore': 'Core setting',
      'create.memberCorePlaceholder': 'Identity, speech, relationships, what matters, limits, and secrets (never volunteered).',
      'create.coreHint': 'Injected every turn; 4,000 characters or fewer is recommended.',
      'create.addMember': 'Add a third member',
      'create.remove': 'Remove',
      'create.submit': 'Create group',
      'create.submitting': 'Creating…',
      'create.cancel': 'Cancel',
      'create.back': 'Back to chat',
      'create.hint': 'Extended settings, model overrides, and budgets are available under Manage.',
      'header.members': '{n} members',
      'header.tokens': '{n} tokens',
      'header.pinned': '{n} pinned',
      'header.budget': 'Budget {used}/{max}',
      'header.manage': 'Manage',
      'header.export': 'Export',
      'header.newGroup': 'New group',
      'header.switchGroup': 'Switch group',
      'header.generating': '{name} is typing…',
      'header.stop': 'Stop',
      'header.defaultModel': 'Default model: {model}',
      'messages.owner': 'Owner',
      'messages.pin': 'Pin',
      'messages.unpin': 'Unpin',
      'messages.copy': 'Copy',
      'messages.copied': 'Copied',
      'messages.rewrite': 'Rewrite',
      'messages.rewriting': 'Rewriting…',
      'messages.usageTitle': 'Input {input} · output {output} · cache read {cacheRead} · cache write {cacheWrite}',
      'messages.folded': '{n} earlier messages folded out of the prompt (pinned messages stay)',
      'messages.showFolded': 'Show',
      'messages.hideFolded': 'Hide',
      'messages.foldedTag': 'Folded',
      'messages.typing': '{name} is typing',
      'messages.stoppedTag': 'Stopped, not saved',
      'messages.rewrittenTag': 'Rewriting…',
      'messages.empty': 'No messages yet. Say something, or @ a member in the composer.',
      'messages.emptyHint': 'Only @ changes who replies; without one the turn rotates.',
      'composer.placeholder': 'Say something… (Enter to send, Shift+Enter for a new line)',
      'composer.send': 'Send',
      'composer.mention': 'Mention a member',
      'composer.owner': 'Owner',
      'composer.busy': 'Generating; the composer is paused.',
      'composer.stopping': 'Stopping…',
      'composer.disabled': 'Generating…',
      'composer.count': '{n}/8000',
      'manage.title': 'Group management',
      'manage.close': 'Close',
      'manage.tab.group': 'Settings',
      'manage.tab.members': 'Members',
      'manage.tab.export': 'Export',
      'common.save': 'Save',
      'common.saving': 'Saving…',
      'common.saved': 'Saved',
      'common.cancel': 'Cancel',
      'common.delete': 'Remove',
      'common.none': '(none)',
      'common.add': 'Add',
      'group.name': 'Group name',
      'group.brief': 'Brief',
      'group.policyTitle': 'Reply rules',
      'group.replyMode': 'Reply mode',
      'group.replyModeValue': '@ first, then rotate',
      'group.maxMentionReplies': 'Maximum mentioned members answered per owner message',
      'group.maxHandoffDepth': 'Maximum handoff depth',
      'group.maxHistory': 'Recent messages included in the prompt',
      'group.maxPinned': 'Pinned message limit',
      'group.maxReplyChars': 'Maximum reply length',
      'group.modelTitle': 'Model',
      'group.modelInherit': 'Follow the Host default model',
      'group.modelProvider': 'Provider',
      'group.modelId': 'Model',
      'group.budgetTitle': 'Budget',
      'group.maxInputTokens': 'Input token limit',
      'group.maxOutputTokens': 'Output token limit',
      'group.dataDir': 'Data directory',
      'group.defaultModel': 'Host default: {model}',
      'group.noDefaultModel': 'The Host has no default model selected',
      'group.policyHint': 'Applies immediately; already generated messages are unchanged.',
      'group.budgetHint': 'Generation stops and records a notice once accumulated usage reaches a limit. 0 disables a limit.',
      'group.modelHint': 'Leave the group override empty to follow the Host default; each member can override again.',
      'members.title': 'Members',
      'members.add': 'Add member',
      'members.editing': 'Editing {name}',
      'members.new': 'New member',
      'members.name': 'Display name (used by @, up to 16 characters)',
      'members.oneLiner': 'Public one-liner',
      'members.relations': 'Public relationships',
      'members.relationWith': 'With {name}',
      'members.core': 'Core setting (injected every turn)',
      'members.extended': 'Extended setting (optional)',
      'members.extendedEnabled': 'Include the extended setting (only while enabled)',
      'members.coreCount': '{n} / 4,000 recommended',
      'members.extendedCount': '{n} / 8,000 recommended',
      'members.overLimit': '{n} characters over the recommendation: saving still works, but context shrinks.',
      'members.modelTitle': 'Model override',
      'members.modelInherit': 'Follow the group / Host default',
      'members.save': 'Save member',
      'members.addSave': 'Add member',
      'members.atLeastTwo': 'A group needs at least two members.',
      'members.empty': 'No members yet.',
      'members.modelValue': 'Current: {model}',
      'export.includeHistory': 'Include history (superseded messages)',
      'export.generate': 'Generate Markdown',
      'export.generating': 'Generating…',
      'export.empty': 'The preview appears here and is written to the group\'s export/script.md.',
      'export.copy': 'Copy',
      'export.download': 'Download',
      'export.path': 'Written to: {path}',
      'export.filename': 'group-chat.md',
      'export.failed': 'Export failed',
      'settings.title': 'Group chat',
      'settings.description': 'Manage groups, member settings, models, and budgets. Chat lives in the Group chat panel.',
      'settings.open': 'Open the Group chat panel',
      'settings.groups': 'Groups',
      'settings.new': 'New group',
      'settings.empty': 'No groups yet. Create one first.',
      'settings.hint': 'Settings, pins, and token totals sync into the Group chat panel immediately.',
      'errors.busy': 'Generation is running; stop it first.',
      'errors.rewriteLatest': 'Only the newest effective member reply can be rewritten.',
      'errors.copy': 'Could not copy',
      'errors.name': 'The group name cannot be empty.',
      'errors.members': 'Please fill in two or three member names.',
    };

    /**
     * Interpolate `{name}` placeholders.
     * @param {string} text - template.
     * @param {Record<string, string|number>} [params] - values.
     * @returns {string} text.
     */
    function fill(text, params) {
      if (params === undefined) return text;
      return text.replace(/\{(\w+)\}/g, (match, key) => (params[key] === undefined ? match : String(params[key])));
    }

    /** @param {number} value - token count. @returns {string} compact text. */
    function fmtTokens(value) {
      const n = Number(value) || 0;
      if (n < 1000) return String(n);
      if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
      return `${(n / 1_000_000).toFixed(2)}M`;
    }

    /** @param {number} ts - epoch seconds. @param {boolean} [withDate] - include the date. @returns {string} time. */
    function fmtTime(ts, withDate = false) {
      if (!Number.isFinite(ts) || ts <= 0) return '';
      const date = new Date(ts * 1000);
      const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      if (!withDate) return time;
      return `${date.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' })} ${time}`;
    }

    /** Palette used for member avatars (artwork colors, not theme tokens). */
    const AVATAR_COLORS = ['#a06a4f', '#4f7a6a', '#6a5f9e', '#8f5a74', '#5f7a9e', '#7a814f'];

    /** @param {Array<object>} members - members. @param {string|null} memberId - member. @returns {string} color. */
    function avatarColor(members, memberId) {
      const index = Math.max(0, members.findIndex((member) => member.id === memberId));
      return AVATAR_COLORS[index % AVATAR_COLORS.length];
    }

    /** @param {string} name - display name. @returns {string} first glyph. */
    function initialOf(name) {
      return [...(name || '?')][0] ?? '?';
    }

    /** @param {object} response - failed fetch response. @returns {Promise<string>} message. */
    async function errorMessage(response) {
      try {
        const data = await response.json();
        if (data?.error?.message) return data.error.message;
      } catch {
        /* fall through */
      }
      return `HTTP ${response.status}`;
    }

    /**
     * The panel store: authoritative state, incremental stream application,
     * and all host calls. It lives outside React so switching panels does not
     * abort an in-flight generation.
     * @returns {object} store.
     */
    function createStore() {
      let state = {
        loaded: false,
        loading: true,
        error: null,
        groups: [],
        selectedId: null,
        group: null,
        members: [],
        messages: [],
        notices: [],
        totals: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
        foldedCount: 0,
        pinnedCount: 0,
        supersededCount: 0,
        latestMessageId: null,
        latestMemberMessageId: null,
        activeTurn: null,
        defaultModel: null,
        dataDir: null,
        warnings: [],
        models: null,
        modelsError: null,
        busy: false,
        stopping: false,
        streaming: null,
        actionError: null,
        actionNotice: null,
        rewritingId: null,
      };
      const listeners = new Set();
      let activeAbort = null;
      let modelsPromise = null;

      const getSnapshot = () => state;
      const subscribe = (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      };
      /** @param {object} patch - state slice. @returns {void} */
      function emit(patch) {
        state = { ...state, ...patch };
        for (const listener of listeners) listener();
      }
      /** @param {string} key - localStorage key. @returns {string|null} value. */
      function readSelected() {
        try {
          return window.localStorage.getItem(key);
        } catch {
          return null;
        }
      }
      /** @param {string|null} id - group id. @returns {void} */
      function writeSelected(id) {
        try {
          if (id === null) window.localStorage.removeItem(SELECTED_KEY);
          else window.localStorage.setItem(SELECTED_KEY, id);
        } catch {
          /* local storage may be unavailable */
        }
      }

      /** @param {object} selected - state payload group. @returns {void} */
      function applySelected(selected) {
        if (selected === null || selected === undefined) {
          emit({
            group: null,
            members: [],
            messages: [],
            notices: [],
            totals: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
            foldedCount: 0,
            pinnedCount: 0,
            supersededCount: 0,
            latestMessageId: null,
            latestMemberMessageId: null,
            activeTurn: null,
            warnings: [],
          });
          return;
        }
        emit({
          group: selected.group,
          members: selected.members,
          messages: selected.messages,
          notices: selected.notices ?? [],
          totals: selected.totals,
          foldedCount: selected.foldedCount ?? 0,
          pinnedCount: selected.pinnedCount ?? 0,
          supersededCount: selected.supersededCount ?? 0,
          latestMessageId: selected.latestMessageId ?? null,
          latestMemberMessageId: selected.latestMemberMessageId ?? null,
          activeTurn: selected.activeTurn ?? null,
          warnings: selected.warnings ?? [],
        });
      }

      /**
       * Fetch authoritative state.
       * @param {string|null} [groupId] - requested group.
       * @param {{quiet?: boolean}} [options] - quiet refresh.
       * @returns {Promise<void>} completion.
       */
      async function load(groupId, options = {}) {
        const wanted = groupId ?? state.selectedId ?? readSelected() ?? null;
        if (!options.quiet) emit({ loading: state.group === null, error: null });
        try {
          const params = new URLSearchParams();
          if (wanted !== null) params.set('groupId', wanted);
          const response = await fetch(`api/groupchat.state${params.size > 0 ? `?${params}` : ''}`, {
            credentials: 'same-origin',
            headers: { accept: 'application/json' },
          });
          if (!response.ok) throw new Error(await errorMessage(response));
          const data = await response.json();
          const selectedId = data.selectedId ?? null;
          emit({
            loaded: true,
            loading: false,
            error: null,
            groups: data.groups ?? [],
            selectedId,
            defaultModel: data.defaultModel ?? null,
            dataDir: data.dataDir ?? null,
          });
          applySelected(data.selected ?? null);
          if (selectedId !== null) writeSelected(selectedId);
        } catch (error) {
          if (options.quiet) return;
          emit({ loaded: true, loading: false, error: error instanceof Error ? error.message : String(error) });
        }
      }

      /**
       * Switch the visible group.
       * @param {string} groupId - group id.
       * @returns {Promise<void>} completion.
       */
      async function selectGroup(groupId) {
        if (state.busy) return;
        writeSelected(groupId);
        emit({ selectedId: groupId, streaming: null, actionError: null, actionNotice: null });
        await load(groupId);
      }

      /** @param {object} patch - message patch. @returns {void} */
      function mergeMessage(message, extra = {}) {
        const exists = state.messages.some((candidate) => candidate.id === message.id);
        const member = state.members.find((candidate) => candidate.id === message.memberId);
        const next = {
          ...message,
          memberName: message.memberName ?? (message.role === 'user' ? '群主' : member?.name ?? '成员'),
          ...extra,
        };
        if (exists) {
          emit({ messages: state.messages.map((candidate) => (candidate.id === message.id ? next : candidate)) });
        } else {
          emit({ messages: [...state.messages, next] });
        }
      }

      /** @param {object} event - NDJSON event. @returns {void} */
      function dispatch(event) {
        switch (event.type) {
          case 'message': {
            const wasRewrite = event.message.supersedes;
            if (wasRewrite) {
              emit({ messages: state.messages.filter((message) => message.id !== wasRewrite) });
            }
            mergeMessage(event.message);
            emit({ streaming: null, rewritingId: null });
            break;
          }
          case 'supersede': {
            emit({ messages: state.messages.filter((message) => message.id !== event.target) });
            break;
          }
          case 'generating': {
            emit({
              streaming: {
                memberId: event.memberId ?? null,
                memberName: event.memberName ?? '成员',
                text: '',
                replyIndex: event.replyIndex ?? 1,
                rewriteOf: event.rewrite ?? null,
                stopped: false,
              },
              rewritingId: event.rewrite ?? null,
            });
            break;
          }
          case 'delta': {
            if (state.streaming === null) break;
            emit({ streaming: { ...state.streaming, text: state.streaming.text + event.text } });
            break;
          }
          case 'notice': {
            emit({ notices: [...state.notices, event.notice].slice(-20) });
            break;
          }
          case 'totals': {
            emit({ totals: event.totals });
            break;
          }
          case 'state': {
            applySelected(event.state);
            emit({ streaming: null, rewritingId: null });
            break;
          }
          case 'error': {
            emit({ actionError: event.message, streaming: null, rewritingId: null });
            break;
          }
          case 'stopped': {
            if (state.streaming !== null) {
              emit({ streaming: { ...state.streaming, stopped: true } });
            }
            break;
          }
          default:
            break;
        }
      }

      /**
       * POST a streamed turn and apply its events.
       * @param {string} path - route.
       * @param {object} body - JSON body.
       * @returns {Promise<void>} completion.
       */
      async function stream(path, body) {
        if (state.busy) return;
        if (state.group === null) return;
        const controller = new AbortController();
        activeAbort = controller;
        emit({ busy: true, stopping: false, actionError: null, actionNotice: null });
        try {
          const response = await fetch(`api/${path}`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json', accept: 'application/x-ndjson' },
            body: JSON.stringify({ ...body, groupId: state.group.id }),
            signal: controller.signal,
          });
          if (!response.ok) throw new Error(await errorMessage(response));
          if (response.body === null) throw new Error('浏览器不支持流式响应。');
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let index;
            while ((index = buffer.indexOf('\n')) >= 0) {
              const line = buffer.slice(0, index).trim();
              buffer = buffer.slice(index + 1);
              if (line.length === 0) continue;
              try {
                dispatch(JSON.parse(line));
              } catch {
                /* ignore a malformed line rather than losing the turn */
              }
            }
          }
          if (buffer.trim().length > 0) {
            try {
              dispatch(JSON.parse(buffer));
            } catch {
              /* ignore */
            }
          }
        } catch (error) {
          if (error?.name === 'AbortError') {
            emit({ actionNotice: '已停止生成；已生成的部分不会写入有效消息。' });
          } else {
            emit({ actionError: error instanceof Error ? error.message : String(error), streaming: null });
          }
        } finally {
          activeAbort = null;
          const keepStopped = state.streaming !== null && state.streaming.stopped === true;
          emit({ busy: false, stopping: false, ...(keepStopped ? {} : { streaming: null }) });
        }
      }

      /** @param {string} text - owner message. @returns {Promise<void>} completion. */
      async function send(text) {
        if (state.busy || state.group === null) return;
        await stream('groupchat.send', { text });
      }

      /** @returns {Promise<void>} completion. */
      async function stop() {
        if (!state.busy && state.activeTurn === null) return;
        emit({ stopping: true });
        if (activeAbort !== null) activeAbort.abort();
        try {
          await fetch('api/groupchat.stop', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ groupId: state.group?.id }),
          });
        } catch {
          /* the fetch abort already stops generation */
        }
      }

      /** @param {string} messageId - newest message. @returns {Promise<void>} completion. */
      async function rewrite(messageId) {
        if (state.busy || state.group === null) return;
        await stream('groupchat.rewrite', { messageId });
      }

      /** @param {string} messageId - message. @param {boolean} pinned - desired pin state. @returns {Promise<void>} completion. */
      async function pin(messageId, pinned) {
        if (state.group === null) return;
        try {
          const response = await fetch('api/groupchat.pin', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ groupId: state.group.id, messageId, pinned }),
          });
          if (!response.ok) throw new Error(await errorMessage(response));
          const data = await response.json();
          applySelected(data.state);
        } catch (error) {
          emit({ actionError: error instanceof Error ? error.message : String(error) });
        }
      }

      /** @param {object} patch - group fields. @returns {Promise<object>} updated group. */
      async function saveGroup(patch) {
        if (state.group === null) throw new Error('没有选中的群。');
        const response = await fetch('api/groupchat.group-update', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ groupId: state.group.id, ...patch }),
        });
        if (!response.ok) throw new Error(await errorMessage(response));
        const data = await response.json();
        applySelected(data.state);
        emit({ groups: state.groups.map((group) => (group.id === data.state.group.id ? { ...group, name: data.state.group.name, brief: data.state.group.brief } : group)) });
        return data.state.group;
      }

      /** @param {object} member - member fields, with memberId to edit. @returns {Promise<object>} saved member. */
      async function saveMember(member) {
        if (state.group === null) throw new Error('没有选中的群。');
        const response = await fetch('api/groupchat.member-save', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ groupId: state.group.id, ...member }),
        });
        if (!response.ok) throw new Error(await errorMessage(response));
        const data = await response.json();
        applySelected(data.state);
        return data.member;
      }

      /** @param {{name: string, brief: string, members: Array<object>}} input - new group. @returns {Promise<object>} state. */
      async function createGroup(input) {
        const response = await fetch('api/groupchat.group-create', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        });
        if (!response.ok) throw new Error(await errorMessage(response));
        const data = await response.json();
        writeSelected(data.groupId);
        emit({ loaded: true, loading: false, error: null });
        applySelected(data.state);
        await load(data.groupId);
        return data;
      }

      /** @param {boolean} includeHistory - include superseded versions. @returns {Promise<object>} export result. */
      async function exportMarkdown(includeHistory) {
        if (state.group === null) throw new Error('没有选中的群。');
        const response = await fetch('api/groupchat.export', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ groupId: state.group.id, includeHistory }),
        });
        if (!response.ok) throw new Error(await errorMessage(response));
        return response.json();
      }

      /** @returns {Promise<void>} loads the provider/model catalog once. */
      async function loadModels() {
        if (state.models !== null) return;
        if (modelsPromise !== null) return modelsPromise;
        modelsPromise = (async () => {
          try {
            const response = await fetch('api/groupchat.models', { credentials: 'same-origin' });
            if (!response.ok) throw new Error(await errorMessage(response));
            const data = await response.json();
            emit({ models: data, modelsError: null });
          } catch (error) {
            emit({ models: null, modelsError: error instanceof Error ? error.message : String(error) });
          } finally {
            modelsPromise = null;
          }
        })();
        return modelsPromise;
      }

      /** @param {string} message - action error. @returns {void} */
      function setActionError(message) {
        emit({ actionError: message });
      }

      /** @returns {void} */
      function clearActionError() {
        emit({ actionError: null, actionNotice: null });
      }

      return {
        getSnapshot,
        subscribe,
        load,
        selectGroup,
        send,
        stop,
        rewrite,
        pin,
        saveGroup,
        saveMember,
        createGroup,
        exportMarkdown,
        loadModels,
        setActionError,
        clearActionError,
      };
    }

    const StoreContext = React.createContext(null);
    const LocaleContext = React.createContext((key) => key);

    /** @returns {object} store from context. */
    function useChatStore() {
      return React.useContext(StoreContext);
    }
    /** @returns {(key: string, params?: object) => string} translator. */
    function useT() {
      return React.useContext(LocaleContext);
    }
    /** @param {object} store - panel store. @returns {object} snapshot. */
    function useChatState(store) {
      return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    }

    /**
     * One inline SVG wrapper so icons inherit text color and stroke width.
     * @param {{size?: number, children: any, viewBox?: string}} props - icon props.
     * @returns {any} element.
     */
    function Svg({ size = 14, children, viewBox = '0 0 24 24' }) {
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          focusable: false,
          style: { display: 'block', flex: 'none' },
        },
        children,
      );
    }

    /** @param {{size?: number}} props - size. @returns {any} pin icon. */
    function IconPin({ size = 13 }) {
      return h(Svg, { size }, h('path', { d: 'M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6Z' }), h('path', { d: 'M12 14v7' }));
    }
    /** @param {{size?: number}} props - size. @returns {any} copy icon. */
    function IconCopy({ size = 13 }) {
      return h(Svg, { size }, h('rect', { x: 9, y: 9, width: 11, height: 11, rx: 2 }), h('path', { d: 'M5 15V5a2 2 0 0 1 2-2h8' }));
    }
    /** @param {{size?: number}} props - size. @returns {any} rewrite icon. */
    function IconRewrite({ size = 13 }) {
      return h(Svg, { size }, h('path', { d: 'M20 11a8 8 0 1 0-2.3 5.7' }), h('path', { d: 'M20 4v5h-5' }));
    }
    /** @param {{size?: number}} props - size. @returns {any} close icon. */
    function IconClose({ size = 16 }) {
      return h(Svg, { size }, h('path', { d: 'M6 6l12 12M18 6L6 18' }));
    }
    /** @param {{size?: number}} props - size. @returns {any} chevron icon. */
    function IconChevron({ size = 14 }) {
      return h(Svg, { size }, h('path', { d: 'M6 9l6 6 6-6' }));
    }
    /** @param {{size?: number}} props - size. @returns {any} send icon. */
    function IconSend({ size = 14 }) {
      return h(Svg, { size }, h('path', { d: 'M4 12L20 4l-6 16-3-7-7-1Z' }));
    }
    /** @param {{size?: number}} props - size. @returns {any} stop icon. */
    function IconStop({ size = 13 }) {
      return h(Svg, { size }, h('rect', { x: 7, y: 7, width: 10, height: 10, rx: 2, fill: 'currentColor', stroke: 'none' }));
    }
    /** @param {{size?: number}} props - size. @returns {any} chat glyph. */
    function IconChat({ size = 22 }) {
      return h(
        Svg,
        { size },
        h('path', { d: 'M4 5h16v10H9l-5 4V5Z' }),
        h('path', { d: 'M8 10h.01M12 10h.01M16 10h.01', strokeWidth: 2.2 }),
      );
    }
    /** @param {{size?: number}} props - size. @returns {any} download icon. */
    function IconDownload({ size = 13 }) {
      return h(Svg, { size }, h('path', { d: 'M12 4v11' }), h('path', { d: 'M7 10l5 5 5-5' }), h('path', { d: 'M5 20h14' }));
    }
    /** @param {{size?: number}} props - size. @returns {any} external/open icon. */
    function IconOpen({ size = 13 }) {
      return h(Svg, { size }, h('path', { d: 'M14 4h6v6' }), h('path', { d: 'M20 4l-9 9' }), h('path', { d: 'M18 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5' }));
    }

    /**
     * Render body text with resolved `@` references highlighted.
     * @param {{text: string, members: Array<object>, ownerName: string}} props - text.
     * @returns {any} element.
     */
    function MentionText({ text, members, ownerName }) {
      const names = new Set([ownerName, ...members.map((member) => member.name)]);
      const parts = String(text ?? '').split(/(@[^\s@，。！？、,.!?:：;；]{1,16})/g);
      return h(
        'div',
        { className: 'mgc-text' },
        parts.map((part, index) => {
          if (part.startsWith('@') && names.has(part.slice(1))) {
            return h('span', { className: 'mgc-mention', key: index }, part);
          }
          return part;
        }),
      );
    }

    /**
     * Avatar circle for an owner or member.
     * @param {{name: string, color?: string|null, owner?: boolean, small?: boolean}} props - avatar props.
     * @returns {any} element.
     */
    function Avatar({ name, color, owner = false, small = false }) {
      return h(
        'span',
        {
          className: `mgc-av${small ? ' mgc-avSm' : ''}${owner ? ' mgc-avOwner' : ''}`,
          style: owner ? undefined : { background: color ?? '#6a7280' },
          'aria-hidden': true,
        },
        initialOf(name),
      );
    }

    /** @param {{children: any}} props - children. @returns {any} dot pulse. */
    function TypingDots({ children }) {
      return h('span', { className: 'mgc-dots' }, h('i'), h('i'), h('i'), children);
    }

    /**
     * One effective message.
     * @param {object} props - message and callbacks.
     * @returns {any} element.
     */
    function MessageRow({ message, members, t, continuation, canRewrite, busy, rewriting, onPin, onRewrite }) {
      const [copied, setCopied] = useState(false);
      const timer = useRef(null);
      useEffect(() => () => clearTimeout(timer.current), []);
      const owner = message.role === 'user';
      const member = members.find((candidate) => candidate.id === message.memberId);
      const name = owner ? t('messages.owner') : member?.name ?? message.memberName ?? '成员';
      const color = owner ? null : avatarColor(members, message.memberId);
      const usage = message.usage;
      const copy = async () => {
        try {
          if (navigator.clipboard !== undefined) {
            await navigator.clipboard.writeText(message.text);
          } else {
            const area = document.createElement('textarea');
            area.value = message.text;
            area.style.position = 'fixed';
            area.style.opacity = '0';
            document.body.appendChild(area);
            area.select();
            document.execCommand('copy');
            area.remove();
          }
          setCopied(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopied(false), 1400);
        } catch {
          setCopied(false);
        }
      };
      return h(
        'article',
        {
          className: `mgc-msg${continuation ? ' mgc-msgCont' : ''}${message.folded ? ' mgc-foldMsg' : ''}`,
          'data-message-id': message.id,
        },
        h(Avatar, { name, color, owner }),
        h(
          'div',
          { className: 'mgc-body' },
          h(
            'div',
            { className: 'mgc-meta' },
            h('span', { className: 'mgc-name' }, name),
            h('span', { className: 'mgc-time' }, fmtTime(message.ts)),
            message.pinned ? h('span', { className: 'mgc-tag mgc-tagPin' }, h(IconPin, { size: 10 }), t('messages.pin')) : null,
            message.folded ? h('span', { className: 'mgc-tag' }, t('messages.foldedTag')) : null,
            rewriting ? h('span', { className: 'mgc-tag mgc-tagWarn' }, t('messages.rewrittenTag')) : null,
            usage
              ? h(
                  'span',
                  {
                    className: 'mgc-usage',
                    title: t('messages.usageTitle', {
                      input: usage.inputTokens,
                      output: usage.outputTokens,
                      cacheRead: usage.cacheReadTokens,
                      cacheWrite: usage.cacheWriteTokens,
                    }),
                  },
                  `↑${fmtTokens(usage.inputTokens)} ↓${fmtTokens(usage.outputTokens)}`,
                )
              : null,
          ),
          h(MentionText, { text: message.text, members, ownerName: t('messages.owner') }),
          h(
            'div',
            { className: 'mgc-actions' },
            h(
              'button',
              {
                type: 'button',
                className: 'mgc-action',
                onClick: () => onPin(message.id, !message.pinned),
                title: message.pinned ? t('messages.unpin') : t('messages.pin'),
              },
              h(IconPin, { size: 11 }),
              message.pinned ? t('messages.unpin') : t('messages.pin'),
            ),
            h(
              'button',
              { type: 'button', className: 'mgc-action', onClick: copy, title: t('messages.copy') },
              h(IconCopy, { size: 11 }),
              copied ? t('messages.copied') : t('messages.copy'),
            ),
            canRewrite
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'mgc-action',
                    onClick: () => onRewrite(message.id),
                    disabled: busy,
                    title: t('messages.rewrite'),
                  },
                  h(IconRewrite, { size: 11 }),
                  t('messages.rewrite'),
                )
              : null,
          ),
        ),
      );
    }

    /**
     * Partial text of the member currently generating.
     * @param {{streaming: object}} props - stream state.
     * @returns {any} element.
     */
    function TypingRow({ streaming, members }) {
      const t = useT();
      const stopped = streaming.stopped === true;
      return h(
        'article',
        { className: 'mgc-msg', 'aria-live': 'polite' },
        h(Avatar, { name: streaming.memberName, color: avatarColor(members, streaming.memberId) }),
        h(
          'div',
          { className: 'mgc-body' },
          h(
            'div',
            { className: 'mgc-meta' },
            h('span', { className: 'mgc-name' }, streaming.memberName),
            stopped
              ? h('span', { className: 'mgc-tag mgc-tagWarn' }, t('messages.stoppedTag'))
              : h('span', { className: 'mgc-typingLabel' }, t('messages.typing', { name: streaming.memberName })),
          ),
          streaming.text.length > 0
            ? h(MentionText, { text: streaming.text, members, ownerName: t('messages.owner') })
            : h('div', { className: 'mgc-text' }, h(TypingDots)),
        ),
      );
    }

    /**
     * One persisted notice (budget pause and similar).
     * @param {{notice: object}} props - notice.
     * @returns {any} element.
     */
    function NoticeRow({ notice }) {
      return h(
        'div',
        { className: 'mgc-noticeRow' },
        h(
          'div',
          { className: `mgc-notice${notice.level === 'warn' ? ' mgc-noticeWarn' : ''}` },
          h('span', { 'aria-hidden': true }, '!'),
          h('span', null, notice.text),
        ),
      );
    }

    /**
     * Conversation body: folded banner, messages and notices in time order,
     * and the live partial reply.
     * @param {object} props - thread inputs.
     * @returns {any} element.
     */
    function Thread({ state, t, showFolded, onToggleFolded, onPin, onRewrite }) {
      const wrapRef = useRef(null);
      const stick = useRef(true);
      const messages = state.messages;
      const visible = showFolded ? messages : messages.filter((message) => !message.folded);
      const items = useMemo(() => {
        const merged = [
          ...visible.map((message) => ({ kind: 'message', ts: message.ts, message })),
          ...state.notices.slice(-8).map((notice) => ({ kind: 'notice', ts: notice.ts, notice })),
        ];
        merged.sort((left, right) => left.ts - right.ts);
        return merged;
      }, [visible, state.notices]);
      const prevById = useMemo(() => {
        const map = new Map();
        messages.forEach((message, index) => map.set(message.id, messages[index - 1] ?? null));
        return map;
      }, [messages]);
      useEffect(() => {
        const element = wrapRef.current;
        if (element !== null && stick.current) element.scrollTop = element.scrollHeight;
      }, [messages.length, state.notices.length, state.streaming?.text, state.group?.id]);
      useEffect(() => {
        stick.current = true;
        const element = wrapRef.current;
        if (element !== null) element.scrollTop = element.scrollHeight;
      }, [state.group?.id]);
      const onScroll = () => {
        const element = wrapRef.current;
        if (element === null) return;
        stick.current = element.scrollHeight - element.scrollTop - element.clientHeight < 140;
      };
      return h(
        'div',
        { className: 'mgc-threadWrap', ref: wrapRef, onScroll },
        h(
          'div',
          { className: 'mgc-thread' },
          state.foldedCount > 0
            ? h(
                'div',
                { className: 'mgc-foldBar' },
                h(
                  'button',
                  { type: 'button', className: 'mgc-foldBtn', onClick: onToggleFolded },
                  t('messages.folded', { n: state.foldedCount }),
                  h(IconChevron, { size: 11 }),
                  showFolded ? t('messages.hideFolded') : t('messages.showFolded'),
                ),
              )
            : null,
          items.length === 0 && state.streaming === null
            ? h(
                'div',
                { className: 'mgc-threadEmpty' },
                h('div', { className: 'mgc-threadEmptyGlyph' }, h(IconChat, { size: 28 })),
                h('div', null, t('messages.empty')),
                h('div', { style: { fontSize: '12px', opacity: 0.8 } }, t('messages.emptyHint')),
              )
            : null,
          items.map((item) => {
            if (item.kind === 'notice') return h(NoticeRow, { key: `n_${item.notice.id}`, notice: item.notice });
            const message = item.message;
            const previous = prevById.get(message.id);
            const continuation = previous !== undefined
              && previous !== null
              && previous.role === 'member'
              && message.role === 'member'
              && previous.turn === message.turn;
            return h(MessageRow, {
              key: message.id,
              message,
              members: state.members,
              t,
              continuation,
              canRewrite: message.role === 'member'
                && message.id === state.latestMemberMessageId
                && message.folded !== true,
              busy: state.busy,
              rewriting: state.rewritingId === message.id,
              onPin,
              onRewrite,
            });
          }),
          state.streaming !== null
            ? h(TypingRow, { streaming: state.streaming, members: state.members, key: 'streaming' })
            : null,
        ),
      );
    }

    /**
     * Composer with the `@` picker, Enter to send, and the stop control.
     * @param {object} props - composer inputs.
     * @returns {any} element.
     */
    function Composer({ state, t, onSend, onStop }) {
      const [text, setText] = useState('');
      const [menuOpen, setMenuOpen] = useState(false);
      const areaRef = useRef(null);
      const menuRef = useRef(null);
      const busy = state.busy;
      useEffect(() => {
        const area = areaRef.current;
        if (area === null) return;
        area.style.height = 'auto';
        area.style.height = `${Math.min(180, Math.max(46, area.scrollHeight))}px`;
      }, [text]);
      useEffect(() => {
        if (!menuOpen) return;
        const onDown = (event) => {
          if (menuRef.current !== null && !menuRef.current.contains(event.target)) setMenuOpen(false);
        };
        const onKey = (event) => {
          if (event.key === 'Escape') setMenuOpen(false);
        };
        document.addEventListener('pointerdown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
          document.removeEventListener('pointerdown', onDown);
          document.removeEventListener('keydown', onKey);
        };
      }, [menuOpen]);
      const submit = () => {
        const value = text.trim();
        if (value.length === 0 || busy) return;
        setText('');
        onSend(value);
      };
      const insertMention = (name) => {
        const area = areaRef.current;
        const start = area?.selectionStart ?? text.length;
        const end = area?.selectionEnd ?? text.length;
        const next = `${text.slice(0, start)}@${name} ${text.slice(end)}`;
        setText(next);
        setMenuOpen(false);
        requestAnimationFrame(() => {
          if (area === null) return;
          area.focus();
          const caret = start + name.length + 2;
          area.setSelectionRange(caret, caret);
        });
      };
      const onKeyDown = (event) => {
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent?.isComposing) {
          event.preventDefault();
          submit();
        }
      };
      const mentionItems = [...state.members, { id: '__owner__', name: t('messages.owner'), public: { oneLiner: t('composer.owner') } }];
      return h(
        'footer',
        { className: 'mgc-composer' },
        h(
          'div',
          { className: 'mgc-composerInner' },
          h(
            'div',
            { className: 'mgc-inputWrap', 'data-disabled': busy ? 'true' : 'false' },
            h('textarea', {
              ref: areaRef,
              className: 'mgc-textarea',
              value: text,
              placeholder: t('composer.placeholder'),
              disabled: busy,
              rows: 1,
              onChange: (event) => setText(event.target.value),
              onKeyDown,
              'aria-label': t('composer.placeholder'),
            }),
            h(
              'div',
              { className: 'mgc-composerBar' },
              h(
                'div',
                { className: 'mgc-popWrap', ref: menuRef },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'mgc-iconBtn',
                    onClick: () => setMenuOpen((open) => !open),
                    disabled: busy || state.members.length === 0,
                    title: t('composer.mention'),
                    'aria-label': t('composer.mention'),
                    'aria-expanded': menuOpen,
                  },
                  h('span', { style: { fontSize: '15px', fontWeight: 600 } }, '@'),
                ),
                menuOpen
                  ? h(
                      'div',
                      { className: 'mgc-menu mgc-menuUp', role: 'menu' },
                      h('div', { className: 'mgc-menuHead' }, t('composer.mention')),
                      mentionItems.map((member) =>
                        h(
                          'button',
                          {
                            key: member.id,
                            type: 'button',
                            className: 'mgc-menuRow',
                            role: 'menuitem',
                            onClick: () => insertMention(member.name),
                          },
                          h(Avatar, {
                            name: member.name,
                            color: member.id === '__owner__' ? null : avatarColor(state.members, member.id),
                            owner: member.id === '__owner__',
                            small: true,
                          }),
                          h('span', { style: { flex: 1, minWidth: 0 } }, member.name),
                        ),
                      ),
                    )
                  : null,
              ),
              text.length > 400 ? h('span', { className: 'mgc-count' }, t('composer.count', { n: text.length })) : null,
              busy
                ? h(
                    'button',
                    { type: 'button', className: 'mgc-send mgc-stop', onClick: onStop, disabled: state.stopping },
                    h(IconStop, { size: 12 }),
                    state.stopping ? t('composer.stopping') : t('header.stop'),
                  )
                : h(
                    'button',
                    { type: 'button', className: 'mgc-send', onClick: submit, disabled: text.trim().length === 0 },
                    h(IconSend, { size: 13 }),
                    t('composer.send'),
                  ),
            ),
          ),
          h(
            'div',
            { className: 'mgc-composerHint' },
            busy ? t('composer.busy') : `${t('messages.emptyHint')}`,
          ),
        ),
      );
    }

    /**
     * Header: group switcher, token summary, and the management actions.
     * @param {object} props - header inputs.
     * @returns {any} element.
     */
    function Header({ state, t, onOpen, onNewGroup, onStop }) {
      const [menuOpen, setMenuOpen] = useState(false);
      const wrapRef = useRef(null);
      useEffect(() => {
        if (!menuOpen) return;
        const onDown = (event) => {
          if (wrapRef.current !== null && !wrapRef.current.contains(event.target)) setMenuOpen(false);
        };
        const onKey = (event) => {
          if (event.key === 'Escape') setMenuOpen(false);
        };
        document.addEventListener('pointerdown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
          document.removeEventListener('pointerdown', onDown);
          document.removeEventListener('keydown', onKey);
        };
      }, [menuOpen]);
      const model = state.defaultModel;
      const modelText = model === null ? t('group.noDefaultModel') : `${model.provider} / ${model.model}`;
      const used = state.totals.inputTokens + state.totals.outputTokens;
      const max = state.budget?.maxInputTokens ?? 0;
      const ratio = max > 0 ? Math.min(1, used / max) : 0;
      return h(
        'header',
        { className: 'mgc-header' },
        h(
          'div',
          { className: 'mgc-headMain' },
          h(
            'div',
            { className: 'mgc-titleRow' },
            h(
              'div',
              { className: 'mgc-popWrap', ref: wrapRef },
              h(
                'button',
                {
                  type: 'button',
                  className: 'mgc-groupBtn',
                  onClick: () => setMenuOpen((open) => !open),
                  title: t('header.switchGroup'),
                  'aria-expanded': menuOpen,
                },
                h('span', { className: 'mgc-groupName' }, state.group.name),
                h('span', { className: 'mgc-chevron' }, h(IconChevron, { size: 13 })),
              ),
              menuOpen
                ? h(
                    'div',
                    { className: 'mgc-menu', role: 'menu' },
                    h('div', { className: 'mgc-menuHead' }, t('header.switchGroup')),
                    state.groups.map((group) =>
                      h(
                        'button',
                        {
                          key: group.id,
                          type: 'button',
                          className: 'mgc-menuRow',
                          role: 'menuitem',
                          disabled: state.busy || group.id === state.group.id,
                          onClick: () => {
                            setMenuOpen(false);
                            if (group.id !== state.group.id) onOpen('switch', group.id);
                          },
                        },
                        h('span', { style: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, group.name),
                        h('small', null, t('header.members', { n: group.memberCount })),
                      ),
                    ),
                    h('div', { className: 'mgc-menuSep' }),
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'mgc-menuRow',
                        role: 'menuitem',
                        disabled: state.busy,
                        onClick: () => {
                          setMenuOpen(false);
                          onNewGroup();
                        },
                      },
                      h('span', { style: { flex: 1 } }, t('header.newGroup')),
                      h('span', { 'aria-hidden': true }, '+'),
                    ),
                  )
                : null,
            ),
          ),
          h(
            'div',
            { className: 'mgc-sub' },
            h('span', null, t('header.members', { n: state.members.length })),
            h('span', { className: 'mgc-dot' }),
            h('span', { title: modelText }, t('header.tokens', { n: fmtTokens(used) })),
            state.pinnedCount > 0 ? h('span', { className: 'mgc-dot' }) : null,
            state.pinnedCount > 0 ? h('span', null, t('header.pinned', { n: state.pinnedCount })) : null,
            max > 0 ? h('span', { className: 'mgc-dot' }) : null,
            max > 0 ? h('span', null, t('header.budget', { used: fmtTokens(used), max: fmtTokens(max) })) : null,
          ),
          max > 0
            ? h(
                'div',
                { className: 'mgc-budgetBar', title: modelText },
                h('div', { className: 'mgc-budgetFill', 'data-over': ratio >= 1 ? 'true' : 'false', style: { width: `${Math.round(ratio * 100)}%` } }),
              )
            : null,
        ),
        h(
          'div',
          { className: 'mgc-headActions' },
          state.activeTurn !== null && !state.busy
            ? h(
                'span',
                { className: 'mgc-tag mgc-tagWarn', style: { height: 26, padding: '0 10px', borderRadius: 13 } },
                h(TypingDots),
                t('header.generating', { name: state.activeTurn.memberName ?? '成员' }),
              )
            : null,
          h(
            'button',
            { type: 'button', className: 'mgc-btn', onClick: () => onOpen('group') },
            t('header.manage'),
          ),
          h(
            'button',
            { type: 'button', className: 'mgc-btn', onClick: () => onOpen('export') },
            t('header.export'),
          ),
        ),
      );
    }

    /**
     * App-level error/notice banners above the composer.
     * @param {{state: object, t: object, store: object}} props - banners.
     * @returns {any} element.
     */
    function Banners({ state, t, store }) {
      if (state.error !== null) {
        return h(
          'div',
          { className: 'mgc-banner' },
          h('span', null, `${t('loadFailed')}：${state.error}`),
          h('button', { type: 'button', className: 'mgc-btn', onClick: () => store.load() }, t('retry')),
        );
      }
      if (state.actionError !== null) {
        return h(
          'div',
          { className: 'mgc-banner' },
          h('span', null, state.actionError),
          h('button', { type: 'button', className: 'mgc-btn', onClick: () => store.clearActionError() }, '×'),
        );
      }
      if (state.actionNotice !== null) {
        return h(
          'div',
          { className: 'mgc-banner mgc-bannerWarn' },
          h('span', null, state.actionNotice),
          h('button', { type: 'button', className: 'mgc-btn', onClick: () => store.clearActionError() }, '×'),
        );
      }
      return null;
    }

    /**
     * The panel page.
     * @returns {any} element.
     */
    function App() {
      const store = useChatStore();
      const t = useT();
      const state = useChatState(store);
      const [drawer, setDrawer] = useState(null);
      const [creating, setCreating] = useState(false);
      const [showFolded, setShowFolded] = useState(false);
      useEffect(() => {
        store.load();
      }, [store]);
      useEffect(() => {
        setShowFolded(false);
      }, [state.group?.id]);
      useEffect(() => {
        if (state.activeTurn === null || state.busy) return undefined;
        const id = setInterval(() => store.load(state.selectedId, { quiet: true }), 1500);
        return () => clearInterval(id);
      }, [state.activeTurn, state.busy, state.selectedId, store]);
      if (!state.loaded && state.loading) {
        return h('div', { className: 'mgc-loading' }, h('span', { className: 'mgc-spin' }), ' ', t('loading'));
      }
      if (state.group === null) {
        if (state.error !== null) {
          return h(
            'div',
            { className: 'mgc-emptyState' },
            h('h2', null, t('loadFailed')),
            h('p', null, state.error),
            h('button', { type: 'button', className: 'mgc-btn mgc-btnPrimary', onClick: () => store.load() }, t('retry')),
          );
        }
        return h(CreateGroupForm, {
          store,
          t,
          embedded: false,
          allowCancel: state.groups.length > 0 && creating,
          onCancel: () => setCreating(false),
          onCreated: () => setCreating(false),
        });
      }
      if (creating) {
        return h(CreateGroupForm, {
          store,
          t,
          embedded: false,
          allowCancel: true,
          onCancel: () => setCreating(false),
          onCreated: () => setCreating(false),
        });
      }
      const uiBusy = state.busy || state.activeTurn !== null;
      const uiState = uiBusy === state.busy ? state : { ...state, busy: uiBusy };
      return h(
        'section',
        { className: 'mgc-page', 'aria-label': t('panel') },
        h(Header, {
          state,
          t,
          onOpen: (kind, value) => {
            if (kind === 'switch') store.selectGroup(value);
            else setDrawer(kind);
          },
          onNewGroup: () => setCreating(true),
          onStop: () => store.stop(),
        }),
        h(Thread, {
          state: uiState,
          t,
          showFolded,
          onToggleFolded: () => setShowFolded((open) => !open),
          onPin: (messageId, pinned) => store.pin(messageId, pinned),
          onRewrite: (messageId) => store.rewrite(messageId),
        }),
        state.error !== null || state.actionError !== null || state.actionNotice !== null
          ? h('div', { className: 'mgc-bannerSlot' }, h(Banners, { state, t, store }))
          : null,
        h(Composer, {
          state: uiState,
          t,
          onSend: (text) => store.send(text),
          onStop: () => store.stop(),
        }),
        drawer === null
          ? null
          : h(
              React.Fragment,
              null,
              h('div', { className: 'mgc-backdrop', onClick: () => setDrawer(null) }),
              h(ManageDrawer, {
                state,
                t,
                store,
                tab: drawer,
                onTab: setDrawer,
                onClose: () => setDrawer(null),
              }),
            ),
      );
    }

    /**
     * Shared read-only model hint plus optional provider/model override inputs.
     * @param {object} props - model inputs.
     * @returns {any} element.
     */
    function ModelFields({ t, inherit, onInherit, provider, model, onProvider, onModel, defaultModel, catalog, idPrefix }) {
      const providerList = catalog?.providers ?? [];
      return h(
        'div',
        null,
        h(
          'label',
          { className: 'mgc-check', style: { marginBottom: '8px' } },
          h('input', { type: 'checkbox', checked: inherit, onChange: (event) => onInherit(event.target.checked) }),
          t('group.modelInherit'),
        ),
        inherit
          ? h(
              'div',
              { className: 'mgc-hint' },
              defaultModel === null ? t('group.noDefaultModel') : t('group.defaultModel', { model: `${defaultModel.provider} / ${defaultModel.model}` }),
            )
          : h(
              'div',
              { className: 'mgc-row2' },
              h(
                'div',
                { className: 'mgc-field', style: { marginBottom: 0 } },
                h('label', { className: 'mgc-label', htmlFor: `${idPrefix}-provider` }, t('group.modelProvider')),
                h('input', {
                  id: `${idPrefix}-provider`,
                  className: 'mgc-input',
                  value: provider,
                  list: `${idPrefix}-providers`,
                  onChange: (event) => onProvider(event.target.value),
                  placeholder: 'deepseek',
                  spellCheck: false,
                }),
                h(
                  'datalist',
                  { id: `${idPrefix}-providers` },
                  providerList.map((item) => h('option', { key: item.id, value: item.id }, item.name)),
                ),
              ),
              h(
                'div',
                { className: 'mgc-field', style: { marginBottom: 0 } },
                h('label', { className: 'mgc-label', htmlFor: `${idPrefix}-model` }, t('group.modelId')),
                h('input', {
                  id: `${idPrefix}-model`,
                  className: 'mgc-input',
                  value: model,
                  list: `${idPrefix}-models`,
                  onChange: (event) => onModel(event.target.value),
                  placeholder: 'deepseek-chat',
                  spellCheck: false,
                }),
                h(
                  'datalist',
                  { id: `${idPrefix}-models` },
                  providerList.flatMap((item) =>
                    (item.models ?? []).map((entry) => h('option', { key: `${item.id}/${entry.id}`, value: entry.id }, entry.name)),
                  ),
                ),
              ),
            ),
        h('div', { className: 'mgc-hint', style: { marginTop: '6px' } }, t('group.modelHint')),
      );
    }

    /**
     * Group settings form, used by the drawer and the settings section.
     * @param {{state: object, t: object, store: object}} props - form inputs.
     * @returns {any} element.
     */
    function GroupSettingsForm({ state, t, store }) {
      const group = state.group;
      const initial = useMemo(
        () => ({
          name: group.name,
          brief: group.brief ?? '',
          maxMentionReplies: group.policy.maxMentionReplies,
          maxHandoffDepth: group.policy.maxHandoffDepth,
          maxHistory: group.policy.maxHistory,
          maxPinned: group.policy.maxPinned,
          maxReplyChars: group.policy.maxReplyChars,
          maxInputTokens: group.budget.maxInputTokens,
          maxOutputTokens: group.budget.maxOutputTokens,
          inheritModel: group.model === null || group.model === undefined,
          provider: group.model?.provider ?? state.defaultModel?.provider ?? '',
          model: group.model?.model ?? state.defaultModel?.model ?? '',
        }),
        [group.id],
      );
      const uid = useRef(`mgc-group-${Math.random().toString(36).slice(2, 7)}`);
      const [draft, setDraft] = useState(initial);
      const [saving, setSaving] = useState(false);
      const [error, setError] = useState(null);
      const [saved, setSaved] = useState(false);
      useEffect(() => {
        store.loadModels();
      }, [store]);
      const patch = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
      const save = async () => {
        if (draft.name.trim().length === 0) {
          setError(t('errors.name'));
          return;
        }
        if (!draft.inheritModel && (draft.provider.trim().length === 0 || draft.model.trim().length === 0)) {
          setError(t('group.modelHint'));
          return;
        }
        setSaving(true);
        setError(null);
        setSaved(false);
        try {
          await store.saveGroup({
            name: draft.name.trim(),
            brief: draft.brief,
            policy: {
              maxMentionReplies: Number(draft.maxMentionReplies),
              maxHandoffDepth: Number(draft.maxHandoffDepth),
              maxHistory: Number(draft.maxHistory),
              maxPinned: Number(draft.maxPinned),
              maxReplyChars: Number(draft.maxReplyChars),
            },
            budget: {
              maxInputTokens: Number(draft.maxInputTokens),
              maxOutputTokens: Number(draft.maxOutputTokens),
            },
            model: draft.inheritModel ? null : { provider: draft.provider.trim(), model: draft.model.trim() },
          });
          setSaved(true);
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : String(reason));
        } finally {
          setSaving(false);
        }
      };
      const numberField = (key, label) =>
        h(
          'div',
          { className: 'mgc-field' },
          h('label', { className: 'mgc-label', htmlFor: `mgc-${key}` }, label),
          h('input', {
            id: `mgc-${key}`,
            className: 'mgc-input',
            type: 'number',
            min: 0,
            value: draft[key],
            onChange: (event) => patch(key, event.target.value),
          }),
        );
      return h(
        'div',
        null,
        h(
          'div',
          { className: 'mgc-field' },
          h('label', { className: 'mgc-label', htmlFor: 'mgc-group-name' }, t('group.name')),
          h('input', {
            id: 'mgc-group-name',
            className: 'mgc-input',
            value: draft.name,
            maxLength: 40,
            onChange: (event) => patch('name', event.target.value),
          }),
        ),
        h(
          'div',
          { className: 'mgc-field' },
          h('label', { className: 'mgc-label', htmlFor: 'mgc-group-brief' }, t('group.brief')),
          h('textarea', {
            id: 'mgc-group-brief',
            className: 'mgc-textarea2',
            value: draft.brief,
            onChange: (event) => patch('brief', event.target.value),
            placeholder: t('create.briefPlaceholder'),
          }),
        ),
        h('div', { className: 'mgc-label', style: { margin: '4px 0 8px' } }, t('group.policyTitle')),
        h(
          'div',
          { className: 'mgc-row2' },
          numberField('maxMentionReplies', t('group.maxMentionReplies')),
          numberField('maxHandoffDepth', t('group.maxHandoffDepth')),
          numberField('maxHistory', t('group.maxHistory')),
          numberField('maxPinned', t('group.maxPinned')),
          numberField('maxReplyChars', t('group.maxReplyChars')),
          h(
            'div',
            { className: 'mgc-field' },
            h('label', { className: 'mgc-label' }, t('group.replyMode')),
            h('div', { className: 'mgc-hint', style: { paddingTop: '7px' } }, t('group.replyModeValue')),
          ),
        ),
        h('div', { className: 'mgc-hint', style: { marginBottom: '18px' } }, t('group.policyHint')),
        h('div', { className: 'mgc-label', style: { margin: '4px 0 8px' } }, t('group.modelTitle')),
        h(ModelFields, {
          t,
          inherit: draft.inheritModel,
          onInherit: (value) => patch('inheritModel', value),
          provider: draft.provider,
          model: draft.model,
          onProvider: (value) => patch('provider', value),
          onModel: (value) => patch('model', value),
          defaultModel: state.defaultModel,
          catalog: state.models,
          idPrefix: uid.current,
        }),
        h(
          'div',
          { className: 'mgc-label', style: { margin: '20px 0 8px' } },
          t('group.budgetTitle'),
        ),
        h(
          'div',
          { className: 'mgc-row2' },
          numberField('maxInputTokens', t('group.maxInputTokens')),
          numberField('maxOutputTokens', t('group.maxOutputTokens')),
        ),
        h('div', { className: 'mgc-hint', style: { marginBottom: '16px' } }, t('group.budgetHint')),
        h(
          'div',
          { className: 'mgc-field' },
          h('div', { className: 'mgc-label' }, t('group.dataDir')),
          h('div', { className: 'mgc-pathText' }, state.dataDir ?? ''),
        ),
        error !== null ? h('p', { className: 'mgc-error' }, error) : null,
        saved ? h('p', { className: 'mgc-success' }, t('common.saved')) : null,
        h(
          'div',
          { className: 'mgc-formActions' },
          h(
            'button',
            { type: 'button', className: 'mgc-btn mgc-btnPrimary', onClick: save, disabled: saving },
            saving ? t('common.saving') : t('common.save'),
          ),
        ),
      );
    }

    /**
     * One member edit form.
     * @param {object} props - form inputs.
     * @returns {any} element.
     */
    function MemberForm({ member, members, state, t, store, onDone, onCancel }) {
      const others = members.filter((candidate) => candidate.id !== member?.id);
      const [name, setName] = useState(member?.name ?? '');
      const [oneLiner, setOneLiner] = useState(member?.public?.oneLiner ?? '');
      const [relations, setRelations] = useState(() => ({ ...(member?.public?.relations ?? {}) }));
      const [core, setCore] = useState(member?.core ?? '');
      const [extended, setExtended] = useState(member?.extended ?? '');
      const [extendedEnabled, setExtendedEnabled] = useState(member?.extendedEnabled === true);
      const [inheritModel, setInheritModel] = useState(member?.model === null || member?.model === undefined);
      const [provider, setProvider] = useState(member?.model?.provider ?? state.defaultModel?.provider ?? '');
      const [model, setModel] = useState(member?.model?.model ?? state.defaultModel?.model ?? '');
      const [saving, setSaving] = useState(false);
      const [error, setError] = useState(null);
      const uid = useRef(`mgc-member-${Math.random().toString(36).slice(2, 7)}`);
      useEffect(() => {
        store.loadModels();
      }, [store]);
      const coreLength = [...core].length;
      const extendedLength = [...extended].length;
      const save = async () => {
        if (name.trim().length === 0) {
          setError(t('members.name'));
          return;
        }
        if (!inheritModel && (provider.trim().length === 0 || model.trim().length === 0)) {
          setError(t('group.modelHint'));
          return;
        }
        setSaving(true);
        setError(null);
        try {
          await store.saveMember({
            ...(member === null ? {} : { memberId: member.id }),
            name: name.trim(),
            oneLiner,
            relations,
            core,
            extended,
            extendedEnabled,
            model: inheritModel ? null : { provider: provider.trim(), model: model.trim() },
          });
          onDone();
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : String(reason));
        } finally {
          setSaving(false);
        }
      };
      return h(
        'div',
        null,
        h(
          'div',
          { className: 'mgc-field' },
          h('label', { className: 'mgc-label', htmlFor: 'mgc-member-name' }, t('members.name')),
          h('input', {
            id: 'mgc-member-name',
            className: 'mgc-input',
            value: name,
            maxLength: 16,
            onChange: (event) => setName(event.target.value),
            placeholder: t('create.memberNamePlaceholder'),
          }),
        ),
        h(
          'div',
          { className: 'mgc-field' },
          h('label', { className: 'mgc-label', htmlFor: 'mgc-member-one' }, t('members.oneLiner')),
          h('input', {
            id: 'mgc-member-one',
            className: 'mgc-input',
            value: oneLiner,
            maxLength: 400,
            onChange: (event) => setOneLiner(event.target.value),
            placeholder: t('create.memberOneLinerPlaceholder'),
          }),
        ),
        others.length > 0
          ? h(
              'div',
              { className: 'mgc-field' },
              h('div', { className: 'mgc-label' }, t('members.relations')),
              others.map((other) =>
                h(
                  'div',
                  { key: other.id, style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' } },
                  h('span', { className: 'mgc-hint', style: { width: '96px', flex: 'none' } }, t('members.relationWith', { name: other.name })),
                  h('input', {
                    className: 'mgc-input',
                    value: relations[other.id] ?? '',
                    maxLength: 200,
                    onChange: (event) => setRelations((current) => ({ ...current, [other.id]: event.target.value })),
                    placeholder: t('common.none'),
                  }),
                ),
              ),
            )
          : null,
        h(
          'div',
          { className: 'mgc-field' },
          h('label', { className: 'mgc-label', htmlFor: 'mgc-member-core' }, t('members.core')),
          h('textarea', {
            id: 'mgc-member-core',
            className: 'mgc-textarea2 mgc-textareaCore',
            value: core,
            onChange: (event) => setCore(event.target.value),
            placeholder: t('create.memberCorePlaceholder'),
          }),
          h(
            'div',
            { className: coreLength > 4000 ? 'mgc-warnText' : 'mgc-hint' },
            coreLength > 4000
              ? t('members.overLimit', { n: coreLength - 4000 })
              : t('members.coreCount', { n: coreLength }),
          ),
        ),
        h(
          'div',
          { className: 'mgc-field' },
          h('label', { className: 'mgc-label', htmlFor: 'mgc-member-extended' }, t('members.extended')),
          h('textarea', {
            id: 'mgc-member-extended',
            className: 'mgc-textarea2',
            value: extended,
            onChange: (event) => setExtended(event.target.value),
          }),
          h(
            'div',
            { className: extendedLength > 8000 ? 'mgc-warnText' : 'mgc-hint' },
            extendedLength > 8000
              ? t('members.overLimit', { n: extendedLength - 8000 })
              : t('members.extendedCount', { n: extendedLength }),
          ),
          h(
            'label',
            { className: 'mgc-check', style: { marginTop: '6px' } },
            h('input', {
              type: 'checkbox',
              checked: extendedEnabled,
              onChange: (event) => setExtendedEnabled(event.target.checked),
            }),
            t('members.extendedEnabled'),
          ),
        ),
        h(
          'div',
          { className: 'mgc-field' },
          h('div', { className: 'mgc-label' }, t('members.modelTitle')),
          h(ModelFields, {
            t,
            inherit: inheritModel,
            onInherit: setInheritModel,
            provider,
            model,
            onProvider: setProvider,
            onModel: setModel,
            defaultModel: state.defaultModel,
            catalog: state.models,
            idPrefix: uid.current,
          }),
        ),
        error !== null ? h('p', { className: 'mgc-error' }, error) : null,
        h(
          'div',
          { className: 'mgc-formActions' },
          onCancel === undefined ? null : h('button', { type: 'button', className: 'mgc-btn', onClick: onCancel }, t('common.cancel')),
          h(
            'button',
            { type: 'button', className: 'mgc-btn mgc-btnPrimary', onClick: save, disabled: saving },
            saving ? t('common.saving') : member === null ? t('members.addSave') : t('members.save'),
          ),
        ),
      );
    }

    /**
     * Member list plus the edit form.
     * @param {{state: object, t: object, store: object}} props - editor inputs.
     * @returns {any} element.
     */
    function MembersEditor({ state, t, store }) {
      const [editing, setEditing] = useState(null);
      const selected = editing === 'new' ? null : state.members.find((member) => member.id === editing) ?? null;
      const started = editing === 'new' || selected !== null;
      if (!started) {
        return h(
          'div',
          null,
          h(
            'div',
            { className: 'mgc-sectionHead' },
            h('h3', { className: 'mgc-cardTitle' }, t('members.title')),
            h(
              'button',
              {
                type: 'button',
                className: 'mgc-btn',
                onClick: () => setEditing('new'),
                disabled: state.members.length >= 3,
              },
              t('members.add'),
            ),
          ),
          state.members.length === 0
            ? h('p', { className: 'mgc-hint' }, t('members.empty'))
            : h(
                'div',
                { className: 'mgc-memberList' },
                state.members.map((member) =>
                  h(
                    'button',
                    {
                      key: member.id,
                      type: 'button',
                      className: 'mgc-memberRow',
                      onClick: () => setEditing(member.id),
                    },
                    h(Avatar, { name: member.name, color: avatarColor(state.members, member.id), small: true }),
                    h(
                      'span',
                      { className: 'mgc-memberText' },
                      h('span', { className: 'mgc-memberName' }, member.name),
                      h('span', { className: 'mgc-memberOneLiner' }, member.public?.oneLiner || t('common.none')),
                    ),
                    h(IconChevron, { size: 12 }),
                  ),
                ),
              ),
          h('div', { className: 'mgc-hint', style: { marginTop: '12px' } }, t('members.atLeastTwo')),
        );
      }
      return h(
        'div',
        null,
        h(
          'div',
          { className: 'mgc-sectionHead' },
          h(
            'h3',
            { className: 'mgc-cardTitle' },
            selected === null ? t('members.new') : t('members.editing', { name: selected.name }),
          ),
          h('button', { type: 'button', className: 'mgc-btn', onClick: () => setEditing(null) }, t('common.cancel')),
        ),
        h(MemberForm, {
          key: selected?.id ?? 'new',
          member: selected,
          members: state.members,
          state,
          t,
          store,
          onDone: () => setEditing(null),
        }),
      );
    }

    /**
     * Markdown export panel.
     * @param {{state: object, t: object, store: object}} props - export inputs.
     * @returns {any} element.
     */
    function ExportPanel({ state, t, store }) {
      const [includeHistory, setIncludeHistory] = useState(false);
      const [loading, setLoading] = useState(false);
      const [result, setResult] = useState(null);
      const [error, setError] = useState(null);
      const [copied, setCopied] = useState(false);
      const run = async () => {
        setLoading(true);
        setError(null);
        setCopied(false);
        try {
          setResult(await store.exportMarkdown(includeHistory));
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : String(reason));
        } finally {
          setLoading(false);
        }
      };
      const copy = async () => {
        if (result === null) return;
        try {
          await navigator.clipboard.writeText(result.markdown);
          setCopied(true);
        } catch {
          setError(t('errors.copy'));
        }
      };
      const download = () => {
        if (result === null) return;
        const blob = new Blob([result.markdown], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${(state.group?.name ?? 'group').replace(/[\\/:*?"<>|]/g, '_')}.md`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      };
      return h(
        'div',
        null,
        h(
          'label',
          { className: 'mgc-check', style: { marginBottom: '12px' } },
          h('input', {
            type: 'checkbox',
            checked: includeHistory,
            onChange: (event) => setIncludeHistory(event.target.checked),
          }),
          t('export.includeHistory'),
        ),
        h(
          'div',
          { className: 'mgc-formActions', style: { justifyContent: 'flex-start', marginBottom: '12px' } },
          h(
            'button',
            { type: 'button', className: 'mgc-btn mgc-btnPrimary', onClick: run, disabled: loading },
            loading ? t('export.generating') : t('export.generate'),
          ),
          result === null
            ? null
            : h('button', { type: 'button', className: 'mgc-btn', onClick: copy }, copied ? t('messages.copied') : t('export.copy')),
          result === null
            ? null
            : h('button', { type: 'button', className: 'mgc-btn', onClick: download }, h(IconDownload, { size: 12 }), t('export.download')),
        ),
        error !== null ? h('p', { className: 'mgc-error' }, error) : null,
        result === null
          ? h('p', { className: 'mgc-hint' }, t('export.empty'))
          : h(
              'div',
              null,
              h('textarea', {
                className: 'mgc-textarea2',
                style: { minHeight: '320px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '12px' },
                readOnly: true,
                value: result.markdown,
                spellCheck: false,
              }),
              h('div', { className: 'mgc-pathText', style: { marginTop: '6px' } }, t('export.path', { path: result.path })),
            ),
      );
    }

    /**
     * Management drawer with the three tabs.
     * @param {object} props - drawer inputs.
     * @returns {any} element.
     */
    function ManageDrawer({ state, t, store, tab, onTab, onClose }) {
      const tabs = [
        ['group', t('manage.tab.group')],
        ['members', t('manage.tab.members')],
        ['export', t('manage.tab.export')],
      ];
      return h(
        'aside',
        { className: 'mgc-drawer', role: 'dialog', 'aria-label': t('manage.title'), 'aria-modal': true },
        h(
          'div',
          { className: 'mgc-drawerHead' },
          h('h2', { className: 'mgc-drawerTitle' }, t('manage.title')),
          h(
            'button',
            { type: 'button', className: 'mgc-iconBtn', onClick: onClose, title: t('manage.close'), 'aria-label': t('manage.close') },
            h(IconClose),
          ),
        ),
        h(
          'div',
          { className: 'mgc-tabs', role: 'tablist' },
          tabs.map(([id, label]) =>
            h(
              'button',
              {
                key: id,
                type: 'button',
                className: 'mgc-tab',
                role: 'tab',
                'aria-selected': tab === id,
                onClick: () => onTab(id),
              },
              label,
            ),
          ),
        ),
        h(
          'div',
          { className: 'mgc-drawerBody' },
          tab === 'group' ? h(GroupSettingsForm, { state, t, store }) : null,
          tab === 'members' ? h(MembersEditor, { state, t, store }) : null,
          tab === 'export' ? h(ExportPanel, { state, t, store }) : null,
        ),
      );
    }

    /**
     * Creation form used by the empty state and the settings section.
     * @param {object} props - creation inputs.
     * @returns {any} element.
     */
    function CreateGroupForm({ store, t, embedded, allowCancel, onCancel, onCreated }) {
      const [name, setName] = useState('');
      const [brief, setBrief] = useState('');
      const [drafts, setDrafts] = useState(() => [
        { key: 'a', name: '', oneLiner: '', core: '' },
        { key: 'b', name: '', oneLiner: '', core: '' },
      ]);
      const [error, setError] = useState(null);
      const [saving, setSaving] = useState(false);
      const patchDraft = (key, field, value) =>
        setDrafts((current) => current.map((draft) => (draft.key === key ? { ...draft, [field]: value } : draft)));
      const addMember = () => {
        if (drafts.length >= 3) return;
        setDrafts((current) => [...current, { key: `m${Date.now()}`, name: '', oneLiner: '', core: '' }]);
      };
      const removeMember = (key) => {
        if (drafts.length <= 2) return;
        setDrafts((current) => current.filter((draft) => draft.key !== key));
      };
      const submit = async () => {
        if (name.trim().length === 0) {
          setError(t('errors.name'));
          return;
        }
        if (drafts.some((draft) => draft.name.trim().length === 0)) {
          setError(t('errors.members'));
          return;
        }
        setSaving(true);
        setError(null);
        try {
          await store.createGroup({
            name: name.trim(),
            brief,
            members: drafts.map((draft) => ({
              name: draft.name.trim(),
              oneLiner: draft.oneLiner,
              core: draft.core,
            })),
          });
          if (onCreated !== undefined) onCreated();
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : String(reason));
        } finally {
          setSaving(false);
        }
      };
      const body = h(
        'div',
        { className: embedded ? 'mgc-createEmbed' : 'mgc-onboardingInner' },
        h('h1', { className: 'mgc-h1' }, t('create.title')),
        h('p', { className: 'mgc-p' }, t('create.desc')),
        h(
          'div',
          { className: 'mgc-field' },
          h('label', { className: 'mgc-label', htmlFor: 'mgc-create-name' }, t('create.name')),
          h('input', {
            id: 'mgc-create-name',
            className: 'mgc-input',
            value: name,
            maxLength: 40,
            onChange: (event) => setName(event.target.value),
            placeholder: t('create.namePlaceholder'),
          }),
        ),
        h(
          'div',
          { className: 'mgc-field' },
          h('label', { className: 'mgc-label', htmlFor: 'mgc-create-brief' }, t('create.brief')),
          h('textarea', {
            id: 'mgc-create-brief',
            className: 'mgc-textarea2',
            value: brief,
            onChange: (event) => setBrief(event.target.value),
            placeholder: t('create.briefPlaceholder'),
          }),
        ),
        h('div', { className: 'mgc-label', style: { margin: '6px 0 8px' } }, t('create.members')),
        drafts.map((draft, index) =>
          h(
            'div',
            { key: draft.key, className: 'mgc-card mgc-memberDraft' },
            h(
              'div',
              { className: 'mgc-draftHead' },
              h('span', { className: 'mgc-draftTitle' }, t('create.memberN', { n: index + 1 })),
              drafts.length > 2
                ? h('button', { type: 'button', className: 'mgc-btn mgc-btnDanger', onClick: () => removeMember(draft.key) }, t('create.remove'))
                : null,
            ),
            h(
              'div',
              { className: 'mgc-row2' },
              h(
                'div',
                { className: 'mgc-field' },
                h('label', { className: 'mgc-label' }, t('create.memberName')),
                h('input', {
                  className: 'mgc-input',
                  value: draft.name,
                  maxLength: 16,
                  onChange: (event) => patchDraft(draft.key, 'name', event.target.value),
                  placeholder: t('create.memberNamePlaceholder'),
                }),
              ),
              h(
                'div',
                { className: 'mgc-field' },
                h('label', { className: 'mgc-label' }, t('create.memberOneLiner')),
                h('input', {
                  className: 'mgc-input',
                  value: draft.oneLiner,
                  maxLength: 400,
                  onChange: (event) => patchDraft(draft.key, 'oneLiner', event.target.value),
                  placeholder: t('create.memberOneLinerPlaceholder'),
                }),
              ),
            ),
            h(
              'div',
              { className: 'mgc-field', style: { marginBottom: 0 } },
              h('label', { className: 'mgc-label' }, t('create.memberCore')),
              h('textarea', {
                className: 'mgc-textarea2',
                value: draft.core,
                onChange: (event) => patchDraft(draft.key, 'core', event.target.value),
                placeholder: t('create.memberCorePlaceholder'),
              }),
              h('div', { className: 'mgc-hint' }, t('create.coreHint')),
            ),
          ),
        ),
        drafts.length < 3
          ? h('button', { type: 'button', className: 'mgc-btn', onClick: addMember }, '+ ', t('create.addMember'))
          : null,
        h('p', { className: 'mgc-hint', style: { margin: '14px 0' } }, t('create.hint')),
        error !== null ? h('p', { className: 'mgc-error' }, error) : null,
        h(
          'div',
          { className: 'mgc-formActions', style: { justifyContent: 'flex-start', marginTop: '4px' } },
          h(
            'button',
            { type: 'button', className: 'mgc-btn mgc-btnPrimary', onClick: submit, disabled: saving },
            saving ? t('create.submitting') : t('create.submit'),
          ),
          allowCancel
            ? h('button', { type: 'button', className: 'mgc-btn', onClick: onCancel }, embedded ? t('common.cancel') : t('create.back'))
            : null,
        ),
      );
      if (embedded) return body;
      return h('section', { className: 'mgc-onboarding' }, body);
    }

    /**
     * Settings section page: group list plus the shared management forms.
     * @param {{ctx: object, close: () => void}} props - section inputs.
     * @returns {any} element.
     */
    function SettingsPage({ ctx, close }) {
      const store = useChatStore();
      const t = useT();
      const state = useChatState(store);
      const [creating, setCreating] = useState(false);
      useEffect(() => {
        store.load();
      }, [store]);
      const openPanel = () => {
        ctx.layout.selectPanel(PANEL_ID);
        close();
      };
      return h(
        'section',
        { className: 'mgc-settingsPage', 'aria-label': t('settings.title') },
        h(
          'div',
          { className: 'mgc-settingsInner' },
          h('h1', { className: 'mgc-h1' }, t('settings.title')),
          h('p', { className: 'mgc-p' }, t('settings.description')),
          h(
            'div',
            { className: 'mgc-section' },
            h(
              'div',
              { className: 'mgc-sectionHead' },
              h('h2', { className: 'mgc-sectionTitle' }, t('settings.groups')),
              h(
                'div',
                { style: { display: 'flex', gap: '8px' } },
                h('button', { type: 'button', className: 'mgc-btn', onClick: openPanel }, h(IconOpen, { size: 12 }), t('settings.open')),
                h('button', { type: 'button', className: 'mgc-btn', onClick: () => setCreating((value) => !value) }, t('settings.new')),
              ),
            ),
            state.groups.length === 0
              ? h('p', { className: 'mgc-hint' }, t('settings.empty'))
              : h(
                  'div',
                  { className: 'mgc-groupList' },
                  state.groups.map((group) =>
                    h(
                      'button',
                      {
                        key: group.id,
                        type: 'button',
                        className: 'mgc-groupRow',
                        'data-active': group.id === state.selectedId,
                        onClick: () => store.selectGroup(group.id),
                      },
                      h(Avatar, { name: group.name, color: avatarColor([], null), small: true }),
                      h(
                        'span',
                        { className: 'mgc-groupText' },
                        h('span', { className: 'mgc-groupNameSm' }, group.name),
                        h(
                          'span',
                          { className: 'mgc-groupMeta' },
                          `${t('header.members', { n: group.memberCount })} · ${t('header.tokens', {
                            n: fmtTokens((group.totals?.inputTokens ?? 0) + (group.totals?.outputTokens ?? 0)),
                          })}`,
                        ),
                      ),
                    ),
                  ),
                ),
          ),
          creating
            ? h(
                'div',
                { className: 'mgc-section' },
                h(CreateGroupForm, {
                  store,
                  t,
                  embedded: true,
                  allowCancel: true,
                  onCancel: () => setCreating(false),
                  onCreated: () => setCreating(false),
                }),
              )
            : null,
          state.group === null
            ? null
            : h(
                React.Fragment,
                null,
                h(
                  'div',
                  { className: 'mgc-section' },
                  h(
                    'div',
                    { className: 'mgc-sectionHead' },
                    h('h2', { className: 'mgc-sectionTitle' }, `${t('manage.tab.group')} · ${state.group.name}`),
                  ),
                  h(GroupSettingsForm, { state, t, store }),
                ),
                h(
                  'div',
                  { className: 'mgc-section' },
                  h(MembersEditor, { state, t, store }),
                ),
              ),
          h('p', { className: 'mgc-hint' }, t('settings.hint')),
        ),
      );
    }

    /**
     * Locale/state provider shared by both slot surfaces.
     * @param {{ctx: object, store: object, children: any}} props - root props.
     * @returns {any} element.
     */
    function LocaleRoot({ ctx, store, children }) {
      const [, bump] = useState(0);
      useEffect(() => ctx.locale.subscribe(() => bump((value) => value + 1)), [ctx]);
      const translate = ctx.locale.bind(NS);
      const t = (key, params) => fill(translate(key), params);
      return h(StoreContext.Provider, { value: store }, h(LocaleContext.Provider, { value: t }, children));
    }

    /**
     * Sidebar panel glyph.
     * @param {{size?: number, active?: boolean}} props - owner props.
     * @returns {any} element.
     */
    function PanelIcon({ size = 20, active = false }) {
      return h(
        Svg,
        { size, viewBox: '0 0 24 24' },
        h('path', { d: 'M4 4.5h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3.5v-3.5H4a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Z', opacity: active ? 1 : 0.92 }),
        h('path', { d: 'M17 10.5h1a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1v3l-3.5-3H11a2 2 0 0 1-2-2', opacity: 0.72 }),
        h('path', { d: 'M7 9.5h.01M10.5 9.5h.01M14 9.5h.01', strokeWidth: 2.4 }),
      );
    }

    /**
     * Register the panel, its sidebar entry, the settings section, the locale
     * dictionaries, and the theme-token stylesheet.
     * @param {object} ctx - Client plugin context.
     * @returns {void}
     */
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'groupchat: dictionaries');
      ctx.effect(() => {
        const tag = document.createElement('style');
        tag.dataset.plugin = '@local/multi-role-groupchat';
        tag.dataset.pluginCss = `${NS}/panel.css`;
        tag.textContent = CSS;
        document.head.appendChild(tag);
        return () => tag.remove();
      }, 'groupchat: stylesheet');
      const store = createStore();
      const panelLabel = () => ctx.locale.bind(NS)('panel');
      const PanelSurface = () => h(LocaleRoot, { ctx, store }, h(App));
      const SectionSurface = (props) =>
        h(LocaleRoot, { ctx, store }, h(SettingsPage, { ctx, close: typeof props?.close === 'function' ? props.close : () => {} }));
      ctx.slots.inject('main', () =>
        ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS }, PanelSurface),
      );
      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 5, locale: NS, label: panelLabel }, PanelIcon),
      );
      ctx.slots.inject('settings.section', () =>
        ctx.slots.register({ name: 'settings.section', id: PANEL_ID, order: 25, locale: NS, label: panelLabel }, SectionSurface),
      );
    }

    return { inject: ['slots', 'locale', 'layout'], apply };
  },
});

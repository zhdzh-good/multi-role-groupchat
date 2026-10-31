window.__ModuleLoader__.load({
  id: '@zhdzh-good/multi-role-groupchat',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useRef, useMemo, useCallback } = React;
    const useSyncExternalStore = React.useSyncExternalStore;

    const NS = 'groupchat';
    const PANEL_ID = 'groupchat';
    const SELECTED_KEY = 'dsh.groupchat.selected.v1';
    const SYNC_CHANNEL = 'dsh.groupchat.sync.v1';
    const SYNC_KEY = 'dsh.groupchat.sync.v1';

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
.mgc-sceneChip{max-width:min(360px,52vw);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border:0;border-radius:6px;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,transparent);color:var(--dsw-alias-brand-primary);font:inherit;font-size:11px;line-height:18px;padding:0 6px;cursor:pointer}
.mgc-sceneChip:hover{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 16%,transparent)}
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
.mgc-msgFocus{border-radius:10px;box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-brand-primary) 55%,transparent);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 6%,transparent)}
.mgc-msgCont{padding-top:1px}
.mgc-av{display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;flex:none;margin-top:1px;color:#fff;font-size:12px;font-weight:600;line-height:1;letter-spacing:.02em;user-select:none}
.mgc-avSm{width:26px;height:26px;font-size:11px}
.mgc-avImg{display:block;width:100%;height:100%;border-radius:50%;object-fit:cover}
.mgc-avatarRow{display:flex;align-items:center;gap:12px;margin-bottom:10px}
.mgc-avatarHint{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:17px}
.mgc-avatarActions{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
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
.mgc-noticeText{min-width:0;overflow-wrap:anywhere}
.mgc-noticeBtn{flex:none;height:22px;padding:0 8px;border:.5px solid currentColor;border-radius:7px;background:transparent;color:inherit;font:inherit;font-size:11px;cursor:pointer}
.mgc-noticeBtn:hover:not(:disabled){background:color-mix(in srgb,currentColor 10%,transparent)}
.mgc-noticeBtn:disabled{opacity:.55;cursor:default}
.mgc-noticeDone{flex:none;opacity:.7;font-size:10px}
.mgc-foldBar{display:flex;align-items:center;justify-content:center;gap:8px;padding:8px 0;margin:6px 0}
.mgc-foldBtn{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l1);border-radius:13px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;cursor:pointer}
.mgc-foldBtn:hover{color:var(--dsw-alias-label-primary);background:color-mix(in srgb,var(--dsw-alias-label-primary) 5%,transparent)}
.mgc-foldMsg{opacity:.5}
.mgc-foldMsg:hover,.mgc-foldMsg:focus-within{opacity:.8}
.mgc-foldMsg.mgc-msgFocus{opacity:1}
.mgc-composer{flex:none;border-top:.5px solid var(--dsw-alias-border-l1);padding:10px clamp(16px,3vw,36px) 16px;background:var(--dsw-alias-bg-base)}
.mgc-composerInner{max-width:840px;margin:0 auto}
.mgc-banner{display:flex;align-items:flex-start;gap:8px;margin:0 0 8px;padding:7px 10px;border-radius:9px;font-size:12px;line-height:18px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 9%,transparent);color:var(--dsw-alias-state-error-primary)}
.mgc-searchPanel{flex:none;border-bottom:.5px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);padding:10px clamp(16px,3vw,36px) 12px}
.mgc-searchRow{display:flex;align-items:center;gap:8px;max-width:840px;margin:0 auto;color:var(--dsw-alias-label-secondary)}
.mgc-searchInput{flex:1;min-width:0;height:32px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l2);border-radius:9px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;outline:none}
.mgc-searchInput:focus{border-color:var(--dsw-alias-brand-primary)}
.mgc-searchMeta{display:flex;align-items:center;flex-wrap:wrap;gap:8px 10px;max-width:840px;margin:7px auto 0}
.mgc-searchSelect{width:auto;max-width:180px;height:28px;padding:0 8px;font-size:12px}
.mgc-searchResults{max-width:840px;max-height:260px;overflow:auto;margin:8px auto 0;display:flex;flex-direction:column;gap:2px}
.mgc-searchResult{display:flex;flex-direction:column;gap:3px;width:100%;padding:7px 8px;border:0;border-radius:8px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}
.mgc-searchResult:hover,.mgc-searchResult:focus-visible{background:color-mix(in srgb,var(--dsw-alias-label-primary) 6%,transparent);outline:none}
.mgc-searchResultHead{display:flex;align-items:center;gap:8px;min-width:0;font-size:11px;line-height:17px;color:var(--dsw-alias-label-secondary)}
.mgc-searchName{font-weight:600;color:var(--dsw-alias-label-primary)}
.mgc-searchTime{font-variant-numeric:tabular-nums}
.mgc-searchSnippet{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.mgc-searchSnippet mark{padding:0 2px;border-radius:3px;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 22%,transparent);color:var(--dsw-alias-label-primary)}
.mgc-searchEmpty{max-width:840px;margin:8px auto 0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
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
.mgc-memoryHead{display:flex;align-items:center;justify-content:space-between;gap:8px}
.mgc-btnSmall{height:24px;padding:0 8px;border-radius:7px;font-size:11px}
.mgc-privateWarning{margin:0 0 12px;padding:8px 10px;border-radius:9px;background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 10%,transparent);color:var(--dsw-alias-state-warn-primary);font-size:11px;line-height:17px}
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
.mgc-formSection{margin:18px 0 10px;padding-top:12px;border-top:.5px solid var(--dsw-alias-border-l1)}
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
.mgc-routeDiag{display:flex;flex-direction:column;gap:2px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;word-break:break-word}
.mgc-dangerZone{margin-top:24px;padding-top:16px;border-top:.5px solid var(--dsw-alias-border-l1)}
.mgc-dangerTitle{margin:0 0 6px;font-size:13px;font-weight:600;line-height:20px;color:var(--dsw-alias-state-error-primary)}
.mgc-dangerDesc{margin:0 0 10px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.mgc-dangerWarning{margin:0 0 10px;font-size:12px;line-height:18px;color:var(--dsw-alias-state-error-primary);white-space:pre-wrap}
.mgc-deleteConfirm{padding:12px;border:.5px solid color-mix(in srgb,var(--dsw-alias-state-error-primary) 35%,transparent);border-radius:12px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 6%,transparent)}
.mgc-bannerSlot{max-width:840px;margin:0 auto;padding:8px clamp(16px,3vw,36px) 0}
.mgc-createEmbed{width:100%}
.mgc-typingLabel{color:var(--dsw-alias-label-secondary);font-size:12px}
.mgc-menuRow:disabled{opacity:.45;cursor:default}
/* ── v1.3 · fixed dark game-panel theme ─────────────────────────────── */
.mgc-page,.mgc-onboarding,.mgc-settingsPage,.mgc-loading,.mgc-emptyState{
color-scheme:dark;
--mgc-bg:#090b0e;
--mgc-panel:#11151a;
--mgc-panel2:#161b21;
--mgc-line:rgba(255,255,255,.08);
--mgc-lineStrong:rgba(255,255,255,.16);
--mgc-text:#f2f3f5;
--mgc-muted:#9aa1aa;
--mgc-yellow:#f4d21f;
--mgc-yellowSoft:rgba(244,210,31,.15);
--mgc-cyan:#67d9f2;
--dsw-alias-bg-base:var(--mgc-bg);
--dsw-alias-bg-layer-1:var(--mgc-panel);
--dsw-alias-bg-overlay:#181d24;
--dsw-alias-label-primary:var(--mgc-text);
--dsw-alias-label-secondary:var(--mgc-muted);
--dsw-alias-border-l1:var(--mgc-line);
--dsw-alias-border-l2:var(--mgc-lineStrong);
--dsw-alias-brand-primary:var(--mgc-yellow);
--dsw-alias-state-warn-primary:#f4b740;
--dsw-alias-state-error-primary:#ff6b6b;
--dsw-alias-state-success-primary:#62d39a;
}
.mgc-page{flex-direction:row;background:radial-gradient(900px 620px at 78% -12%,rgba(103,217,242,.09),transparent 62%),radial-gradient(760px 560px at 8% 112%,rgba(244,210,31,.06),transparent 64%),var(--mgc-bg);color:var(--mgc-text)}
.mgc-main{position:relative;display:flex;flex-direction:column;flex:1;min-width:0;min-height:0;background:radial-gradient(760px 480px at 78% 0%,rgba(103,217,242,.035),transparent 66%),linear-gradient(180deg,rgba(255,255,255,.012),transparent 22%)}
.mgc-rail{position:relative;z-index:8;display:flex;flex-direction:column;flex:none;width:300px;min-height:0;padding:18px 14px 14px;border-right:1px solid var(--mgc-line);background:linear-gradient(180deg,rgba(14,17,22,.98),rgba(8,10,13,.96));box-shadow:18px 0 50px rgba(0,0,0,.2)}
.mgc-railHead{flex:none;padding:2px 6px 14px}
.mgc-railEyebrow{color:var(--mgc-cyan);font-size:10px;font-weight:600;letter-spacing:.18em;line-height:16px;opacity:.8}
.mgc-railTitleRow{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-top:5px}
.mgc-railTitle{margin:0;color:var(--mgc-text);font-size:22px;font-weight:700;line-height:30px;letter-spacing:.02em}
.mgc-railCount{color:var(--mgc-muted);font-size:11px;font-variant-numeric:tabular-nums}
.mgc-railList{display:flex;flex-direction:column;gap:8px;flex:1;min-height:0;overflow:auto;padding:2px 2px 12px;scrollbar-gutter:stable}
.mgc-railRow{position:relative;display:flex;align-items:center;gap:10px;width:100%;min-height:72px;padding:10px;border:1px solid rgba(255,255,255,.06);border-radius:14px;background:rgba(255,255,255,.035);color:inherit;font:inherit;text-align:left;cursor:pointer;transition:background .14s,border-color .14s,transform .14s;overflow:hidden}
.mgc-railRow:hover:not(:disabled){background:rgba(255,255,255,.065);border-color:rgba(255,255,255,.13);transform:translateX(1px)}
.mgc-railRow:focus-visible{outline:2px solid var(--mgc-yellow);outline-offset:2px}
.mgc-railRow:disabled{opacity:.55;cursor:default}
.mgc-railRow[data-active=true]{border-color:rgba(244,210,31,.55);background:linear-gradient(90deg,rgba(244,210,31,.16),rgba(244,210,31,.035));box-shadow:inset 0 0 0 1px rgba(244,210,31,.08)}
.mgc-railRow[data-active=true]:before{content:"";position:absolute;left:0;top:14px;bottom:14px;width:3px;border-radius:0 3px 3px 0;background:var(--mgc-yellow)}
.mgc-railAvatar{display:flex;flex:none}
.mgc-railAvatar .mgc-av{width:38px;height:38px;border-radius:12px;border:1px solid rgba(255,255,255,.18);font-size:14px}
.mgc-railText{display:flex;flex-direction:column;flex:1;min-width:0;gap:2px}
.mgc-railTop{display:flex;align-items:baseline;justify-content:space-between;gap:8px;min-width:0}
.mgc-railName{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--mgc-text);font-size:13px;font-weight:600;line-height:19px}
.mgc-railTime{flex:none;color:var(--mgc-muted);font-size:10px;font-variant-numeric:tabular-nums;line-height:16px}
.mgc-railPreview{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--mgc-muted);font-size:11px;line-height:17px}
.mgc-railMeta{color:rgba(154,161,170,.75);font-size:10px;line-height:16px}
.mgc-railFoot{flex:none;padding:10px 2px 2px;border-top:1px solid var(--mgc-line)}
.mgc-railNew{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;height:36px;border:1px solid rgba(244,210,31,.35);border-radius:12px;background:rgba(244,210,31,.08);color:var(--mgc-yellow);font:inherit;font-size:12px;font-weight:600;cursor:pointer}
.mgc-railNew:hover:not(:disabled){background:rgba(244,210,31,.15);border-color:rgba(244,210,31,.65)}
.mgc-railNew:focus-visible{outline:2px solid var(--mgc-yellow);outline-offset:2px}
.mgc-railNew:disabled{opacity:.45;cursor:default}
.mgc-railHint{margin-top:8px;color:rgba(154,161,170,.62);font-size:10px;line-height:15px;text-align:center}
.mgc-railToggle{display:none;align-items:center;justify-content:center;width:32px;height:32px;padding:0;border:1px solid var(--mgc-lineStrong);border-radius:9px;background:rgba(255,255,255,.04);color:var(--mgc-text);cursor:pointer;flex:none}
.mgc-railToggle:hover{background:rgba(255,255,255,.08)}
.mgc-railToggle:focus-visible{outline:2px solid var(--mgc-yellow);outline-offset:2px}
.mgc-railBackdrop{display:none}
.mgc-header{position:relative;padding:18px 26px 14px;border-bottom:1px solid var(--mgc-line);background:linear-gradient(180deg,rgba(255,255,255,.018),transparent);gap:18px}
.mgc-header:before{content:"";position:absolute;left:26px;right:26px;top:0;height:1px;background:linear-gradient(90deg,var(--mgc-cyan),rgba(103,217,242,.15) 26%,transparent 62%);opacity:.55}
[data-platform=darwin] .mgc-header{padding-top:calc(18px + var(--dsh-frame-top-clearance,0px))}
.mgc-headMain{gap:5px;flex:1;min-width:0}
.mgc-titleRow{gap:10px}
.mgc-groupTitle{margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--mgc-text);font-size:22px;font-weight:700;line-height:30px;letter-spacing:.01em}
.mgc-live{display:inline-flex;align-items:center;gap:5px;flex:none;height:20px;padding:0 7px;border:1px solid rgba(103,217,242,.25);border-radius:10px;background:rgba(103,217,242,.07);color:var(--mgc-cyan);font-size:10px;font-weight:600;line-height:18px;letter-spacing:.04em}
.mgc-live i{display:block;width:5px;height:5px;border-radius:50%;background:var(--mgc-cyan);box-shadow:0 0 7px rgba(103,217,242,.9)}
.mgc-sub{gap:7px;color:var(--mgc-muted);font-size:11px;line-height:18px}
.mgc-dot{background:rgba(154,161,170,.45)}
.mgc-headActions{gap:7px;padding-top:2px}
.mgc-btn{height:30px;padding:0 12px;border:1px solid var(--mgc-lineStrong);border-radius:9px;background:rgba(255,255,255,.035);color:var(--mgc-text);font-size:12px}
.mgc-btn:hover:not(:disabled){background:rgba(255,255,255,.075);border-color:rgba(255,255,255,.24)}
.mgc-btnPrimary{background:var(--mgc-yellow);border-color:var(--mgc-yellow);color:#121418}
.mgc-btnPrimary:hover:not(:disabled){background:#ffe45c;border-color:#ffe45c;color:#121418}
.mgc-btnDanger{color:#ff7d7d;border-color:rgba(255,107,107,.4)}
.mgc-iconBtn{color:var(--mgc-muted)}
.mgc-iconBtn:hover:not(:disabled){background:rgba(255,255,255,.08);color:var(--mgc-text)}
.mgc-budgetBar{max-width:300px;background:rgba(255,255,255,.09)}
.mgc-budgetFill{background:var(--mgc-yellow)}
.mgc-budgetFill[data-over=true]{background:#ff6b6b}
.mgc-threadWrap{background:transparent}
.mgc-thread{max-width:1000px;padding:24px 32px 44px}
.mgc-msg{align-items:flex-start;gap:12px;padding:8px 0}
.mgc-av{width:34px;height:34px;border-radius:12px;border:1px solid rgba(255,255,255,.12);font-size:12px}
.mgc-avSm{width:28px;height:28px;border-radius:10px}
.mgc-avOwner{background:linear-gradient(145deg,#f4d21f,#c7a700);color:#17191c;border-color:rgba(244,210,31,.5)}
.mgc-avImg{border-radius:inherit}
.mgc-msgOwner{flex-direction:row-reverse}
.mgc-msgOwner .mgc-body{display:flex;flex-direction:column;align-items:flex-end;text-align:right}
.mgc-msgOwner .mgc-meta{justify-content:flex-end}
.mgc-msgOwner .mgc-actions{justify-content:flex-end}
.mgc-msgOwner .mgc-av{border-color:rgba(244,210,31,.42);box-shadow:0 0 0 3px rgba(244,210,31,.06)}
.mgc-body{max-width:min(78%,760px)}
.mgc-meta{min-height:18px;gap:7px;font-size:11px;line-height:18px}
.mgc-name{font-size:12px;font-weight:600;color:#dfe3e8}
.mgc-msgOwner .mgc-name{color:#f3e8b0}
.mgc-time{color:rgba(154,161,170,.72);font-size:10px}
.mgc-text{width:fit-content;max-width:100%;margin-top:2px;padding:10px 14px;border:1px solid rgba(255,255,255,.075);border-radius:4px 14px 14px 14px;background:rgba(255,255,255,.075);color:#e9ecef;font-size:14px;line-height:1.68;box-shadow:0 2px 10px rgba(0,0,0,.12)}
.mgc-msgOwner .mgc-text{border-color:rgba(255,255,255,.62);border-radius:14px 4px 14px 14px;background:linear-gradient(145deg,#f7f4eb,#e9e4d7);color:#17191c;box-shadow:0 5px 20px rgba(0,0,0,.22)}
.mgc-msgOwner .mgc-mention{color:#755c00;background:rgba(160,124,0,.13)}
.mgc-mention{color:var(--mgc-yellow);background:rgba(244,210,31,.1)}
.mgc-actions{margin-top:2px;gap:1px}
.mgc-action{color:rgba(154,161,170,.72);font-size:10px}
.mgc-action:hover:not(:disabled){background:rgba(255,255,255,.07);color:var(--mgc-text)}
.mgc-usage{color:rgba(154,161,170,.55);font-size:10px}
.mgc-tag{height:17px;border-radius:8px;background:rgba(255,255,255,.07);color:var(--mgc-muted);font-size:9px;line-height:17px}
.mgc-tagPin{color:var(--mgc-yellow);background:rgba(244,210,31,.11)}
.mgc-tagWarn{color:#f4b740;background:rgba(244,183,64,.11)}
.mgc-typing{padding:10px 0 4px 46px;color:var(--mgc-muted);font-size:12px}
.mgc-noticeRow{padding:8px 0}
.mgc-notice{border:1px solid rgba(255,255,255,.07);border-radius:10px;background:rgba(255,255,255,.045);color:var(--mgc-muted);font-size:11px}
.mgc-noticeWarn{border-color:rgba(244,183,64,.2);color:#f4b740;background:rgba(244,183,64,.07)}
.mgc-foldBtn{border-color:var(--mgc-line);color:var(--mgc-muted);background:rgba(255,255,255,.025)}
.mgc-foldBtn:hover{color:var(--mgc-text);background:rgba(255,255,255,.06)}
.mgc-composer{padding:11px 26px 17px;border-top:1px solid var(--mgc-line);background:linear-gradient(180deg,rgba(9,11,14,.55),#090b0e)}
.mgc-composerInner{max-width:1000px}
.mgc-inputWrap{padding:9px 9px 7px 14px;border:1px solid rgba(255,255,255,.13);border-radius:18px;background:rgba(17,21,26,.94);box-shadow:0 8px 30px rgba(0,0,0,.18)}
.mgc-inputWrap:focus-within{border-color:rgba(244,210,31,.62);box-shadow:0 0 0 3px rgba(244,210,31,.07),0 8px 30px rgba(0,0,0,.2)}
.mgc-textarea{color:var(--mgc-text);font-size:14px}
.mgc-textarea::placeholder{color:rgba(154,161,170,.8)}
.mgc-send{height:31px;border-radius:15px;background:var(--mgc-yellow);color:#121418;font-weight:600}
.mgc-send:hover:not(:disabled){background:#ffe45c}
.mgc-stop{color:#ff7d7d}
.mgc-count,.mgc-composerHint{color:rgba(154,161,170,.72)}
.mgc-bannerSlot{max-width:1000px;padding:8px 32px 0}
.mgc-banner{border:1px solid rgba(255,107,107,.22);background:rgba(255,107,107,.08);color:#ff8b8b;border-radius:10px}
.mgc-bannerWarn{border-color:rgba(244,183,64,.2);background:rgba(244,183,64,.07);color:#f4b740}
.mgc-menu{border-color:var(--mgc-lineStrong);border-radius:12px;background:#181d24;box-shadow:0 18px 50px rgba(0,0,0,.55)}
.mgc-menuRow{color:var(--mgc-text);font-size:12px}
.mgc-menuRow:hover,.mgc-menuRow:focus-visible{background:rgba(255,255,255,.07)}
.mgc-menuRow small{color:var(--mgc-muted)}
.mgc-menuHead{color:var(--mgc-muted)}
.mgc-menuSep{background:var(--mgc-line)}
.mgc-backdrop{background:rgba(0,0,0,.55)}
.mgc-drawer{background:#11151a;border-left:1px solid var(--mgc-lineStrong);box-shadow:-24px 0 60px rgba(0,0,0,.4)}
.mgc-drawerTitle{color:var(--mgc-text)}
.mgc-tabs{border-bottom-color:var(--mgc-line)}
.mgc-tab{color:var(--mgc-muted)}
.mgc-tab:hover{color:var(--mgc-text)}
.mgc-tab[aria-selected=true]{color:var(--mgc-yellow)}
.mgc-tab[aria-selected=true]:after{background:var(--mgc-yellow)}
.mgc-drawerBody{background:#11151a}
.mgc-card,.mgc-section{border-color:var(--mgc-line);background:rgba(255,255,255,.028)}
.mgc-cardTitle,.mgc-sectionTitle{color:var(--mgc-text)}
.mgc-label{color:#b9c0c8}
.mgc-hint{color:var(--mgc-muted)}
.mgc-input,.mgc-select,.mgc-textarea2{border-color:var(--mgc-lineStrong);background:#0c0f13;color:var(--mgc-text)}
.mgc-input:focus,.mgc-select:focus,.mgc-textarea2:focus{border-color:rgba(244,210,31,.62);box-shadow:0 0 0 3px rgba(244,210,31,.06)}
.mgc-check{color:var(--mgc-text)}
.mgc-check input{accent-color:var(--mgc-yellow)}
.mgc-memberRow,.mgc-groupRow{border-color:var(--mgc-line);background:rgba(255,255,255,.025);color:var(--mgc-text)}
.mgc-memberRow:hover,.mgc-groupRow:hover{background:rgba(255,255,255,.06)}
.mgc-memberRow[data-active=true],.mgc-groupRow[data-active=true]{border-color:rgba(244,210,31,.5);background:rgba(244,210,31,.08)}
.mgc-memberName,.mgc-groupNameSm{color:var(--mgc-text)}
.mgc-memberOneLiner,.mgc-groupMeta{color:var(--mgc-muted)}
.mgc-dangerZone{border-top-color:var(--mgc-line)}
.mgc-pathText{color:rgba(154,161,170,.7)}
.mgc-success{color:#62d39a}
.mgc-warnText{color:#f4b740}
.mgc-error{color:#ff7d7d}
.mgc-onboarding,.mgc-settingsPage{background:radial-gradient(760px 520px at 80% -10%,rgba(103,217,242,.08),transparent 60%),var(--mgc-bg);color:var(--mgc-text)}
.mgc-onboardingInner,.mgc-settingsInner{max-width:900px}
.mgc-h1{color:var(--mgc-text);letter-spacing:.01em}
.mgc-p{color:var(--mgc-muted)}
.mgc-emptyState{background:var(--mgc-bg);color:var(--mgc-muted)}
.mgc-emptyState h2{color:var(--mgc-text)}
.mgc-loading{background:var(--mgc-bg);color:var(--mgc-muted)}
.mgc-groupList{gap:8px}
.mgc-groupRow{padding:10px 12px;border-radius:12px}
.mgc-railHint{display:block}
@media (max-width:960px){
.mgc-rail{position:absolute;top:0;bottom:0;left:0;z-index:60;width:min(320px,86vw);transform:translateX(-104%);transition:transform .2s ease;box-shadow:24px 0 70px rgba(0,0,0,.5)}
.mgc-page[data-rail=open] .mgc-rail{transform:translateX(0)}
.mgc-railBackdrop{display:block;position:absolute;inset:0;z-index:55;background:rgba(0,0,0,.58);backdrop-filter:blur(2px)}
.mgc-railToggle{display:inline-flex}
.mgc-header{flex-direction:row;flex-wrap:wrap;gap:12px;padding:16px 16px 12px}
[data-platform=darwin] .mgc-header{padding-top:calc(16px + var(--dsh-frame-top-clearance,0px))}
.mgc-headActions{width:auto;justify-content:flex-end}
.mgc-groupTitle{font-size:19px;line-height:26px}
.mgc-thread{padding:18px 14px 30px}
.mgc-bannerSlot{padding-left:14px;padding-right:14px}
.mgc-composer{padding:10px 14px 14px}
.mgc-body{max-width:84%}
.mgc-header:before{left:16px;right:16px}
}
@media (max-width:560px){
.mgc-groupTitle{font-size:18px}
.mgc-live{display:none}
.mgc-headActions .mgc-btn{padding:0 9px;font-size:11px}
.mgc-body{max-width:88%}
.mgc-text{padding:9px 12px;font-size:13px}
.mgc-railHint{display:none}
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
      'create.fromLibrary': '从角色库选择',
      'create.newCharacters': '新建角色并建群',
      'create.selectHint': '勾选 2–3 个角色。角色档案是全局的，之后改一次所有群同步。',
      'create.selected': '已选 {n} / 3',
      'create.selectAtLeastTwo': '请选择 2–3 个角色。',
      'create.selectTooMany': '最多选择 3 个角色。',
      'create.noLibrary': '角色库还没有角色，可以先新建角色，或直接用下面的“新建角色并建群”。',
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
      'create.fieldsHint': '这里只填基础档案；头像、成员关系、扩展设定和模型覆盖可在创建后的「管理」里补充。',
      'header.members': '成员 {n}',
      'header.tokens': '{n} tokens',
      'header.pinned': '{n} 钉住',
      'header.budget': '预算 {used}/{max}',
      'header.manage': '管理',
      'header.export': '导出',
      'header.newGroup': '新建群聊',
      'header.switchGroup': '切换群聊',
      'header.live': '群聊中',
      'header.openRail': '打开群聊列表',
      'rail.title': '群聊',
      'rail.count': '{n} 个',
      'rail.messages': '{n} 条',
      'rail.noMessages': '还没有消息',
      'rail.new': '新建群聊',
      'rail.hint': '按最近活动排序',
      'header.generating': '{name}正在输入…',
      'header.stop': '停止',
      'header.defaultModel': '默认模型：{model}',
      'messages.owner': '用户',
      'notice.retryHint': '只重试这一条失败回应，不会重复已有消息。',
      'notice.retried': '已重试',
      'messages.pin': '钉住',
      'messages.unpin': '取消钉住',
      'messages.copy': '复制',
      'messages.copied': '已复制',
      'messages.rewrite': '重写',
      'messages.rewriting': '重写中…',
      'messages.usageTitle': '输入 {input} · 输出 {output} · 缓存读 {cacheRead} · 缓存写 {cacheWrite}',
      'messages.folded': '已折叠 {n} 条早期消息（钉住消息保留）',
      'messages.showEarlier': '显示更早的 {n} 条',
      'messages.showFolded': '查看',
      'messages.hideFolded': '收起',
      'messages.foldedTag': '已折叠',
      'messages.typing': '{name}正在输入',
      'messages.stoppedTag': '已停止，未保存',
      'messages.rewrittenTag': '重写中…',
      'messages.empty': '还没有消息。说点什么，或者在输入框里 @ 一位成员。',
      'search.open': '搜索消息',
      'search.close': '关闭搜索',
      'search.placeholder': '搜索当前群的消息…',
      'search.all': '全部角色',
      'search.owner': '我',
      'search.results': '{n} 条结果',
      'search.empty': '没有匹配的消息。',
      'search.hint': '搜索全部历史，包括已折叠消息；最多显示 50 条。',
      'search.folded': '已折叠',
      'search.jump': '跳到消息',
      'messages.emptyHint': '没有 @ 时，插件会先判断你在对谁说；其他人按概率接话。',
      'composer.placeholder': '说点什么…（Enter 发送，Shift+Enter 换行）',
      'composer.send': '发送',
      'composer.mention': '选择成员',
      'composer.owner': '我的角色',
      'composer.busy': '生成中，输入框已暂停。',
      'composer.stopping': '正在停止…',
      'composer.disabled': '生成中…',
      'composer.count': '{n}/8000',
      'manage.title': '群聊管理',
      'manage.close': '关闭',
      'manage.tab.group': '群设置',
      'manage.tab.owner': '我的角色',
      'manage.tab.members': '群成员',
      'manage.tab.characters': '角色库',
      'manage.tab.export': '导出',
      'common.save': '保存',
      'common.saving': '保存中…',
      'common.saved': '已保存',
      'common.cancel': '取消',
      'common.delete': '移除',
      'common.none': '（无）',
      'common.optional': '可选扩展',
      'common.add': '添加',
      'group.name': '群名',
      'group.brief': '群简介',
      'group.scene': '当前场景（可选）',
      'group.sceneHint': '手动记录时间、地点、天气或气氛，每轮注入 prompt；不会自动推进剧情。',
      'group.scenePlaceholder': '例如：晚上九点，旧城书店，停电，雨声很大。',
      'header.scene': '场景：{scene}',
      'header.sceneEdit': '编辑当前场景',
      'group.policyTitle': '接话与路由',
      'group.replyMode': '接话模式',
      'group.replyModeValue': '智能路由：目标必答，其他人按概率接话',
      'group.smartRouting': '智能判断我在对谁说',
      'group.smartRoutingHint': '开启后，没有 @ 时也会结合最近对话和成员档案选择目标；关闭则只靠 @、点名和轮转。',
      'group.maxMentionReplies': '最多先回应几个目标',
      'group.maxHandoffDepth': '接话跳数上限',
      'group.maxHistory': '进入 prompt 的最近消息数',
      'group.maxPinned': '钉住上限',
      'group.maxReplyChars': '单条回应字数上限',
      'group.bystanderChance': '其他人接话概率（%）',
      'group.bystanderChanceHint': '目标回应完后，其余每位成员按这个概率接话；0 表示不主动接话，100 表示都接。',
      'group.modelTitle': '模型',
      'group.modelInherit': '跟随宿主默认模型',
      'group.modelProvider': '模型服务商',
      'group.modelId': '模型',
      'group.budgetTitle': '预算',
      'group.maxInputTokens': '输入 token 上限',
      'group.maxOutputTokens': '输出 token 上限',
      'group.lastRoute': '最近一次路由（诊断）',
      'group.lastRouteNone': '还没有路由记录。',
      'group.routeTargets': '目标：{names}',
      'group.routeBystanders': '旁听：{names}',
      'group.routeMethod': '方式：{method}',
      'group.routeReason': '原因：{reason}',
      'route.method.explicit': '@ / 点名',
      'route.method.pronoun': '你 / 您',
      'route.method.continuation': '短续接',
      'route.method.model': '模型分类',
      'route.method.fallback': '本地兜底',
      'route.method.owner': '交还本人',
      'group.dataDir': '数据目录',
      'group.defaultModel': '宿主默认：{model}',
      'group.noDefaultModel': '宿主还没有选择默认模型',
      'group.policyHint': '保存后立即生效；智能路由只影响之后发送的消息。',
      'group.budgetHint': '累计用量达到上限后停止生成，并写入一条提示。设为 0 表示不限制。',
      'group.modelHint': '从宿主已注册的 provider / model 目录选择；群级覆盖留空时使用宿主默认，成员还可以再单独覆盖。',
      'group.modelLoading': '正在读取模型目录…',
      'group.modelCatalogError': '模型目录读取失败：{message}',
      'group.modelRetry': '重试',
      'group.modelNoProviders': '宿主还没有注册 provider，请先在宿主设置里配置模型。',
      'group.modelNoModels': '这个 provider 没有返回可用模型，请检查宿主配置。',
      'group.modelSelectPlaceholder': '请选择…',
      'group.modelCurrent': '当前',
      'group.modelRequired': '请选择 provider 和 model，或勾选跟随宿主默认。',
      'group.deleteTitle': '危险操作',
      'group.deleteDesc': '删除这个群会永久移除成员设定、消息事件、钉住与导出文件，无法恢复。建议先导出 Markdown。',
      'group.deleteButton': '删除这个群聊',
      'group.deleteBusy': '正在生成，先停止当前回应再删除。',
      'group.deleteWarning': '这会永久删除群目录，无法撤销。请输入完整群名确认。',
      'group.deleteConfirmLabel': '输入「{name}」以确认',
      'group.deleteConfirm': '永久删除',
      'group.deleting': '删除中…',
      'owner.title': '我的角色',
      'owner.optional': '可选；创建后也能在「管理 → 我的角色」修改',
      'owner.optionalHint': '头像和与成员的关系是可选项；名字、一句话和设定会原样进入新建时的角色档案。',
      'owner.hint': '成员每轮都会看到这份档案；角色名也用于 @。',
      'owner.name': '角色名',
      'owner.namePlaceholder': '例如：阿明',
      'owner.nameHint': '默认“用户”；建议改成你在群里的名字（最多 16 字符，不能与成员重名）。',
      'owner.nameRequired': '角色名不能为空。',
      'owner.oneLiner': '角色一句话',
      'owner.oneLinerPlaceholder': '例如：每晚都来书店的常客',
      'owner.relations': '角色与成员的关系',
      'owner.setting': '角色设定（每轮注入）',
      'owner.settingPlaceholder': '身份、与成员的关系、在意的事、底线；成员会据此和你说话。',
      'owner.settingHint': '建议 ≤ 4000 字；保存时不会静默截断。',
      'owner.overLimit': '超出建议长度 {n} 字：仍会保存，但会挤占上下文。',
      'owner.save': '保存角色档案',
      'members.optionalHint': '头像、说话方式、关系、扩展设定与模型覆盖是可选项，不影响新建时的基础档案。',
      'library.title': '角色库',
      'library.new': '新建角色',
      'library.edit': '编辑角色',
      'library.empty': '角色库还是空的。先建一个角色，再拉群。',
      'library.hint': '角色是全局资产；群只引用角色，不再复制档案。',
      'library.usage': '用于 {n} 个群',
      'library.inUse': '还在群里使用，先移出群再删除。',
      'library.deleteConfirm': '确定删除角色“{name}”？此操作不可撤销。',
      'library.delete': '删除角色',
      'library.copy': '复制',
      'library.import': '导入角色卡',
      'library.importHint': 'JSON 角色卡；关系按当前角色库里的名字映射。',
      'library.imported': '角色卡已载入，确认后保存。',
      'library.saved': '角色已保存，所有引用它的群会同步。',
      'members.title': '群成员',
      'members.add': '新建角色',
      'members.pull': '从角色库拉人',
      'members.pullTitle': '拉角色进群',
      'members.pullHint': '只显示还没在这个群里的角色。一个群最多 3 人。',
      'members.noAvailable': '角色库里的角色都已经在这个群里了。',
      'members.remove': '移出群聊',
      'members.removeHint': '只移出这个群，不会删除角色档案。',
      'members.libraryHint': '这里只管理本群成员；角色档案请到「角色库」编辑。',
      'members.editing': '编辑 {name}',
      'members.new': '新成员',
      'members.avatar': '头像',
      'members.avatarChoose': '选择图片',
      'members.avatarRemove': '移除头像',
      'members.avatarHint': '支持 PNG / JPEG / WebP，会裁成 128×128 存入成员卡。',
      'members.name': '显示名（@ 用，≤ 16 字符）',
      'members.oneLiner': '公开档案 · 一句话',
      'members.style': '说话方式（可选）',
      'members.styleHint': '只在本人 prompt 中出现；写称呼、句长、口头禅或语气，不要写秘密。',
      'members.stylePlaceholder': '例如：句子短，少用感叹号；叫阿明“你”，叫周野“周野”。',
      'members.styleCount': '{n} / 300',
      'members.relations': '公开关系',
      'members.relationWith': '与 {name}',
      'members.privateRelations': '私人关系（只给本人看）',
      'members.privateRelationWith': '与 {name}',
      'members.privateRelationsHint': '只进入该成员的 prompt；不写进群简介、system 前缀、路由器或导出文件（除非导出时勾选包含私有）。',
      'members.memory': '私有记忆（只给本人看）',
      'members.memoryHint': '手动维护的长期记忆，例如“阿明最近失业，我不想点破”。只在该成员的 prompt 尾部出现。',
      'members.memoryPlaceholder': '例如：阿明最近失业了，但我不想点破。',
      'members.memoryCount': '{n} / 4000',
      'members.memoryClear': '清空',
      'members.memoryClearConfirm': '清空这份私有记忆？点击「保存成员」后才会生效。',
      'members.privateExport': '导出时包含私有记忆',
      'members.privateExportHint': '默认关闭；开启后导出的成员卡会含私有内容，请妥善保管。',
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
      'export.markdownTitle': 'Markdown 聊天记录',
      'export.privateNote': 'Markdown 聊天记录永远不包含私有记忆和私人关系。要备份私有内容，请在上方导出角色卡并勾选「包含私有记忆」。',
      'portable.title': '角色与群配置',
      'portable.hint': '导出 JSON 备份，或从备份导入为一个新群；不包含消息记录、钉住和导出历史。',
      'portable.importOnlyHint': '选择之前导出的 JSON 群配置，预览后导入为一个新群。',
      'portable.includeAvatars': '包含头像',
      'portable.includePrivate': '包含私有记忆与私人关系',
      'portable.privateNote': '默认不导出。勾选后文件会包含成员的私有记忆和私人关系，请勿分享给他人。',
      'portable.privateWarning': '注意：这个文件包含私有记忆和私人关系。不要分享，也不要提交到公开仓库。',
      'portable.avatarNote': '头像会让文件变大；关闭后仍保留名字、设定和关系。',
      'portable.exportGroup': '导出群配置',
      'portable.exporting': '导出中…',
      'portable.importGroup': '导入群配置',
      'portable.reading': '读取中…',
      'portable.onlyJson': '当前支持 JSON；YAML 将在后续版本加入。',
      'portable.importBusy': '正在生成回应，先停止当前回应再导入新群。',
      'portable.groupExported': '群配置已下载。',
      'portable.previewTitle': '导入预览',
      'portable.previewOwner': '我的角色：{name}',
      'portable.previewScene': '当前场景：{scene}',
      'portable.previewMembers': '成员：{count} 人',
      'portable.previewPolicy': '接话：{targets} 个目标 · 其他人 {chance}%',
      'portable.previewAvatars': '头像：{count} 个',
      'portable.previewBytes': '文件大小：{size}',
      'portable.warnings': '提示：',
      'portable.noWarnings': '校验通过。',
      'portable.imported': '已导入为新群：{name}',
      'portable.importAsNew': '导入为新群',
      'portable.importing': '导入中…',
      'portable.characterExport': '导出角色卡',
      'portable.characterImport': '导入角色卡',
      'portable.characterHint': '角色卡包含公开档案、核心/扩展设定、头像与关系；导出的是已保存版本，关系按名字匹配当前群成员。',
      'portable.characterExported': '角色卡已下载。',
      'portable.characterLoaded': '已载入角色卡，请检查后保存。',
      'portable.tooLarge': '文件超过 4 MB，无法导入。',
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
      'create.fromLibrary': 'Pick from library',
      'create.newCharacters': 'Create characters and group',
      'create.selectHint': 'Select 2–3 characters. Profiles are global, so one edit updates every group.',
      'create.selected': 'Selected {n} / 3',
      'create.selectAtLeastTwo': 'Select 2–3 characters.',
      'create.selectTooMany': 'Select at most 3 characters.',
      'create.noLibrary': 'The library is empty. Create a character here, or use “Create characters and group” below.',
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
      'create.fieldsHint': 'This form covers the basic profile only. Avatars, relationships, extended settings, and model overrides are available under Manage after creation.',
      'header.members': '{n} members',
      'header.tokens': '{n} tokens',
      'header.pinned': '{n} pinned',
      'header.budget': 'Budget {used}/{max}',
      'header.manage': 'Manage',
      'header.export': 'Export',
      'header.newGroup': 'New group',
      'header.switchGroup': 'Switch group',
      'header.live': 'Live',
      'header.openRail': 'Open group list',
      'rail.title': 'Chats',
      'rail.count': '{n}',
      'rail.messages': '{n} msgs',
      'rail.noMessages': 'No messages yet',
      'rail.new': 'New group',
      'rail.hint': 'Recent activity first',
      'header.generating': '{name} is typing…',
      'header.stop': 'Stop',
      'header.defaultModel': 'Default model: {model}',
      'messages.owner': 'User',
      'notice.retryHint': 'Retry only this failed reply; existing messages are kept.',
      'notice.retried': 'Retried',
      'messages.pin': 'Pin',
      'messages.unpin': 'Unpin',
      'messages.copy': 'Copy',
      'messages.copied': 'Copied',
      'messages.rewrite': 'Rewrite',
      'messages.rewriting': 'Rewriting…',
      'messages.usageTitle': 'Input {input} · output {output} · cache read {cacheRead} · cache write {cacheWrite}',
      'messages.folded': '{n} earlier messages folded out of the prompt (pinned messages stay)',
      'messages.showEarlier': 'Show {n} earlier messages',
      'messages.showFolded': 'Show',
      'messages.hideFolded': 'Hide',
      'messages.foldedTag': 'Folded',
      'messages.typing': '{name} is typing',
      'messages.stoppedTag': 'Stopped, not saved',
      'messages.rewrittenTag': 'Rewriting…',
      'messages.empty': 'No messages yet. Say something, or @ a member in the composer.',
      'search.open': 'Search messages',
      'search.close': 'Close search',
      'search.placeholder': 'Search messages in this group…',
      'search.all': 'All members',
      'search.owner': 'Me',
      'search.results': '{n} results',
      'search.empty': 'No matching messages.',
      'search.hint': 'Searches the full history, including folded messages; up to 50 results.',
      'search.folded': 'Folded',
      'search.jump': 'Jump to message',
      'messages.emptyHint': 'Without an @, the router first works out who you mean; the others may chime in by chance.',
      'composer.placeholder': 'Say something… (Enter to send, Shift+Enter for a new line)',
      'composer.send': 'Send',
      'composer.mention': 'Mention a member',
      'composer.owner': 'My character',
      'composer.busy': 'Generating; the composer is paused.',
      'composer.stopping': 'Stopping…',
      'composer.disabled': 'Generating…',
      'composer.count': '{n}/8000',
      'manage.title': 'Group management',
      'manage.close': 'Close',
      'manage.tab.group': 'Settings',
      'manage.tab.owner': 'My character',
      'manage.tab.members': 'Group members',
      'manage.tab.characters': 'Characters',
      'manage.tab.export': 'Export',
      'common.save': 'Save',
      'common.saving': 'Saving…',
      'common.saved': 'Saved',
      'common.cancel': 'Cancel',
      'common.delete': 'Remove',
      'common.none': '(none)',
      'common.optional': 'Optional extras',
      'common.add': 'Add',
      'group.name': 'Group name',
      'group.brief': 'Brief',
      'group.scene': 'Current scene (optional)',
      'group.sceneHint': 'A manual time, place, weather, or mood note injected into every turn. It never advances the plot on its own.',
      'group.scenePlaceholder': 'e.g. 9 pm, the old bookshop, power out, heavy rain.',
      'header.scene': 'Scene: {scene}',
      'header.sceneEdit': 'Edit current scene',
      'group.policyTitle': 'Routing and replies',
      'group.replyMode': 'Reply mode',
      'group.replyModeValue': 'Smart routing: addressees answer, others may chime in',
      'group.smartRouting': 'Infer who I am talking to',
      'group.smartRoutingHint': 'When on, messages without an @ use recent context and public profiles to pick a target; when off, only @, direct names, and rotation are used.',
      'group.maxMentionReplies': 'Maximum guaranteed addressees per owner message',
      'group.maxHandoffDepth': 'Maximum handoff depth',
      'group.maxHistory': 'Recent messages included in the prompt',
      'group.maxPinned': 'Pinned message limit',
      'group.maxReplyChars': 'Maximum reply length',
      'group.bystanderChance': 'Chance for other members to chime in (%)',
      'group.bystanderChanceHint': 'After the addressees reply, each remaining member joins with this probability; 0 never, 100 always.',
      'group.modelTitle': 'Model',
      'group.modelInherit': 'Follow the Host default model',
      'group.modelProvider': '模型服务商',
      'group.modelId': '模型',
      'group.budgetTitle': 'Budget',
      'group.maxInputTokens': 'Input token limit',
      'group.maxOutputTokens': 'Output token limit',
      'group.lastRoute': 'Last route (diagnostics)',
      'group.lastRouteNone': 'No route recorded yet.',
      'group.routeTargets': 'Targets: {names}',
      'group.routeBystanders': 'Bystanders: {names}',
      'group.routeMethod': 'Method: {method}',
      'group.routeReason': 'Reason: {reason}',
      'route.method.explicit': '@ / name',
      'route.method.pronoun': 'you / 您',
      'route.method.continuation': 'short continuation',
      'route.method.model': 'model classifier',
      'route.method.fallback': 'local fallback',
      'route.method.owner': 'hand back to owner',
      'group.dataDir': 'Data directory',
      'group.defaultModel': 'Host default: {model}',
      'group.noDefaultModel': 'The Host has no default model selected',
      'group.policyHint': 'Applies immediately; smart routing only affects messages sent afterwards.',
      'group.budgetHint': 'Generation stops and records a notice once accumulated usage reaches a limit. 0 disables a limit.',
      'group.modelHint': 'Pick from the Host provider / model catalog. Leave the group override empty to follow the Host default; each member can override again.',
      'group.modelLoading': 'Loading model catalog…',
      'group.modelCatalogError': 'Could not load the model catalog: {message}',
      'group.modelRetry': 'Retry',
      'group.modelNoProviders': 'No provider is registered yet. Configure one in the Host settings first.',
      'group.modelNoModels': 'This provider returned no models. Check the Host configuration.',
      'group.modelSelectPlaceholder': 'Select…',
      'group.modelCurrent': 'current',
      'group.modelRequired': 'Choose a provider and model, or follow the Host default.',
      'group.deleteTitle': 'Danger zone',
      'group.deleteDesc': 'Deleting this group permanently removes its member settings, event log, pins, and exports. This cannot be undone. Export Markdown first if you may need it.',
      'group.deleteButton': 'Delete this group',
      'group.deleteBusy': 'Generation is running; stop it before deleting.',
      'group.deleteWarning': 'This permanently deletes the group directory and cannot be undone. Type the full group name to confirm.',
      'group.deleteConfirmLabel': 'Type "{name}" to confirm',
      'group.deleteConfirm': 'Delete permanently',
      'group.deleting': 'Deleting…',
      'owner.title': 'My character',
      'owner.optional': 'Optional; editable later under Manage → My character',
      'owner.optionalHint': 'Avatar and relationships are optional; the name, one-liner, and setting are exactly the character profile entered at creation.',
      'owner.hint': 'Members see this profile every turn; the character name is also used for @.',
      'owner.name': 'Character name',
      'owner.namePlaceholder': 'e.g. Ming',
      'owner.nameHint': 'Defaults to "User"; use your in-group name (up to 16 characters, unique among members).',
      'owner.nameRequired': 'The character name cannot be empty.',
      'owner.oneLiner': 'Character one-liner',
      'owner.oneLinerPlaceholder': 'e.g. A regular who comes to the bookshop every night',
      'owner.relations': 'Character relationships with members',
      'owner.setting': 'Character setting (injected every turn)',
      'owner.settingPlaceholder': 'Identity, relationships, what matters, and limits. Members respond to this.',
      'owner.settingHint': '4,000 characters or fewer recommended; saving never truncates silently.',
      'owner.overLimit': '{n} characters over the recommendation: saving still works, but context shrinks.',
      'owner.save': 'Save character profile',
      'members.optionalHint': 'Avatar, voice/style, relationships, extended settings, and model overrides are optional; they do not change the basic profile entered at creation.',
      'library.title': 'Character library',
      'library.new': 'New character',
      'library.edit': 'Edit character',
      'library.empty': 'The library is empty. Create a character first, then pull it into a group.',
      'library.hint': 'Characters are global assets; groups reference them instead of copying profiles.',
      'library.usage': 'Used by {n} group(s)',
      'library.inUse': 'Still used by a group. Remove it from the group before deleting.',
      'library.deleteConfirm': 'Delete character “{name}”? This cannot be undone.',
      'library.delete': 'Delete character',
      'library.copy': 'Duplicate',
      'library.import': 'Import card',
      'library.importHint': 'JSON character card; relations map by names already in the library.',
      'library.imported': 'Card loaded; review it before saving.',
      'library.saved': 'Character saved; every group using it updates.',
      'members.title': 'Group members',
      'members.add': 'New character',
      'members.pull': 'Pull from library',
      'members.pullTitle': 'Add characters to this group',
      'members.pullHint': 'Only characters not already in this group are shown. A group holds up to 3.',
      'members.noAvailable': 'Every character in the library is already in this group.',
      'members.remove': 'Remove from group',
      'members.removeHint': 'Removes the character from this group only; the profile stays in the library.',
      'members.libraryHint': 'This tab manages the group roster. Edit profiles in the Characters tab.',
      'members.editing': 'Editing {name}',
      'members.new': 'New member',
      'members.avatar': 'Avatar',
      'members.avatarChoose': 'Choose image',
      'members.avatarRemove': 'Remove avatar',
      'members.avatarHint': 'PNG / JPEG / WebP, center-cropped to 128×128 and stored in the member card.',
      'members.name': 'Display name (used by @, up to 16 characters)',
      'members.oneLiner': 'Public one-liner',
      'members.style': 'Voice / speaking style (optional)',
      'members.styleHint': 'Injected only into this member\'s prompt: address forms, sentence length, verbal habits, or tone. Do not put secrets here.',
      'members.stylePlaceholder': 'e.g. Short sentences, few exclamation marks; calls 阿明 “你” and 周野 by name.',
      'members.styleCount': '{n} / 300',
      'members.relations': 'Public relationships',
      'members.relationWith': 'With {name}',
      'members.privateRelations': 'Private relationships (only this member sees them)',
      'members.privateRelationWith': 'With {name}',
      'members.privateRelationsHint': 'Only this member\'s prompt sees these; they never enter the group brief, system prefix, router, or exports unless “include private” is checked.',
      'members.memory': 'Private memory (only this member sees it)',
      'members.memoryHint': 'Manually curated long-term memory, e.g. “阿明 lost his job recently, but I will not bring it up.” Injected only into this member\'s tail.',
      'members.memoryPlaceholder': 'e.g. 阿明 lost his job recently, but I will not bring it up.',
      'members.memoryCount': '{n} / 4,000',
      'members.memoryClear': 'Clear',
      'members.memoryClearConfirm': 'Clear this private memory? Save the member to apply the change.',
      'members.privateExport': 'Include private memory when exporting',
      'members.privateExportHint': 'Off by default; turning it on puts private content in the member card file, so store it safely.',
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
      'export.markdownTitle': 'Markdown transcript',
      'export.privateNote': 'Markdown transcripts never include private memory or private relationships. To back up private content, export a character card above with “include private memory” checked.',
      'portable.title': 'Character and group files',
      'portable.hint': 'Export a JSON backup, or import one as a new group. Messages, pins, and export history are not included.',
      'portable.importOnlyHint': 'Choose a previously exported JSON group config, preview it, then import it as a new group.',
      'portable.includeAvatars': 'Include avatars',
      'portable.includePrivate': 'Include private memory and relationships',
      'portable.privateNote': 'Off by default. When enabled, the file contains private memory and private relationships; do not share it.',
      'portable.privateWarning': 'Warning: this file contains private memory and private relationships. Do not share it or commit it to a public repository.',
      'portable.avatarNote': 'Avatars make the file larger; names, settings, and relations remain without them.',
      'portable.exportGroup': 'Export group config',
      'portable.exporting': 'Exporting…',
      'portable.importGroup': 'Import group config',
      'portable.reading': 'Reading…',
      'portable.onlyJson': 'JSON is supported now; YAML may come later.',
      'portable.importBusy': 'A reply is generating. Stop it before importing a new group.',
      'portable.groupExported': 'Group config downloaded.',
      'portable.previewTitle': 'Import preview',
      'portable.previewOwner': 'My character: {name}',
      'portable.previewScene': 'Current scene: {scene}',
      'portable.previewMembers': 'Members: {count}',
      'portable.previewPolicy': 'Routing: {targets} targets · others {chance}%',
      'portable.previewAvatars': 'Avatars: {count}',
      'portable.previewBytes': 'File size: {size}',
      'portable.warnings': 'Notes:',
      'portable.noWarnings': 'Validation passed.',
      'portable.imported': 'Imported as a new group: {name}',
      'portable.importAsNew': 'Import as new group',
      'portable.importing': 'Importing…',
      'portable.characterExport': 'Export character card',
      'portable.characterImport': 'Import character card',
      'portable.characterHint': 'A character card contains the public profile, core/extended settings, avatar, and relations; exports use the saved version, and relations match current members by name.',
      'portable.characterExported': 'Character card downloaded.',
      'portable.characterLoaded': 'Character card loaded; review it before saving.',
      'portable.tooLarge': 'The file is over 4 MB and cannot be imported.',
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

    /** Hard cap for one search result set. */
    const SEARCH_LIMIT = 50;

    /**
     * Search effective messages in the current group.
     * @param {Array<object>} messages - effective messages.
     * @param {string} query - raw query.
     * @param {string} memberFilter - 'all', 'owner', or a member id.
     * @param {string} ownerName - owner display name.
     * @returns {Array<object>} newest-first matches with snippet offsets.
     */
    function searchMessages(messages, query, memberFilter, ownerName) {
      const needle = query.trim().toLocaleLowerCase();
      if (needle.length === 0) return [];
      const results = [];
      for (let index = messages.length - 1; index >= 0 && results.length < SEARCH_LIMIT; index -= 1) {
        const message = messages[index];
        const text = typeof message?.text === 'string' ? message.text : '';
        if (text.length === 0) continue;
        if (memberFilter === 'owner' && message.role !== 'user') continue;
        if (memberFilter !== 'all' && memberFilter !== 'owner' && message.memberId !== memberFilter) continue;
        const at = text.toLocaleLowerCase().indexOf(needle);
        if (at < 0) continue;
        results.push({
          id: message.id,
          index,
          at,
          text,
          name: message.role === 'user' ? ownerName : message.memberName ?? '成员',
          ts: message.ts,
          folded: message.folded === true,
        });
      }
      return results;
    }

    /** Palette used for member avatars (artwork colors, not theme tokens). */
    const AVATAR_COLORS = ['#a06a4f', '#4f7a6a', '#6a5f9e', '#8f5a74', '#5f7a9e', '#7a814f'];

    /** @param {Array<object>} members - members. @param {string|null} memberId - member. @returns {string} color. */
    function avatarColor(members, memberId) {
      const index = Math.max(0, members.findIndex((member) => member.id === memberId));
      return AVATAR_COLORS[index % AVATAR_COLORS.length];
    }

    /** @param {string} name - group name. @returns {string} stable palette color. */
    function groupColor(name) {
      let hash = 0;
      for (const char of String(name ?? '')) hash = (hash * 31 + char.codePointAt(0)) >>> 0;
      return AVATAR_COLORS[hash % AVATAR_COLORS.length];
    }

    /** @param {string} name - display name. @returns {string} first glyph. */
    function initialOf(name) {
      return [...(name || '?')][0] ?? '?';
    }

    /** @returns {object} default owner profile shown before a group loads. */
    function defaultOwner() {
      return { name: '用户', oneLiner: '', setting: '', avatar: null, relations: {} };
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

    /** Largest portable file the browser will read before asking the Host. */
    const PORTABLE_FILE_LIMIT = 4 * 1024 * 1024;

    /**
     * Format a byte count for previews.
     * @param {number} bytes - size.
     * @returns {string} compact size.
     */
    function fmtBytes(bytes) {
      const value = Number(bytes) || 0;
      if (value < 1024) return `${value} B`;
      if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
      return `${(value / (1024 * 1024)).toFixed(2)} MB`;
    }

    /**
     * Trigger a text download without touching server files.
     * @param {string} filename - download name.
     * @param {string} text - file content.
     * @param {string} mime - MIME type.
     * @returns {void}
     */
    function downloadText(filename, text, mime = 'application/json;charset=utf-8') {
      const blob = new Blob([text], { type: mime });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
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
        characters: [],
        selectedId: null,
        group: null,
        owner: defaultOwner(),
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
        lastRoute: null,
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

      let syncChannel = null;
      let syncTimer = null;
      let syncPending = false;

      /** Tell other tabs that persisted data changed. @returns {void} */
      function publishChange() {
        if (syncChannel !== null) {
          try {
            syncChannel.postMessage({ at: Date.now() });
          } catch {
            /* channel may be closing */
          }
          return;
        }
        try {
          window.localStorage.setItem(SYNC_KEY, `${Date.now()}:${Math.random()}`);
        } catch {
          /* storage may be unavailable */
        }
      }

      /** Refresh from the Host after another tab changed persisted data. @returns {void} */
      function scheduleSyncReload() {
        if (state.busy) {
          syncPending = true;
          return;
        }
        if (syncTimer !== null) clearTimeout(syncTimer);
        syncTimer = setTimeout(() => {
          syncTimer = null;
          if (state.busy) {
            syncPending = true;
            return;
          }
          load(state.selectedId, { quiet: true });
        }, 250);
      }

      /** Run a refresh that arrived while this tab was generating. @returns {void} */
      function flushSyncReload() {
        if (!syncPending) return;
        syncPending = false;
        scheduleSyncReload();
      }

      /** Subscribe to cross-tab change notifications. @returns {void} */
      function startSync() {
        try {
          if (typeof BroadcastChannel === 'function') {
            syncChannel = new BroadcastChannel(SYNC_CHANNEL);
            syncChannel.onmessage = () => scheduleSyncReload();
          }
        } catch {
          syncChannel = null;
        }
        if (syncChannel === null) {
          window.addEventListener('storage', (event) => {
            if (event.key === SYNC_KEY && event.newValue !== null) scheduleSyncReload();
          });
        }
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') scheduleSyncReload();
        });
      }
      startSync();

      /** @param {object} selected - state payload group. @returns {void} */
      function applySelected(selected) {
        if (selected === null || selected === undefined) {
          emit({
            group: null,
            owner: defaultOwner(),
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
            lastRoute: null,
            warnings: [],
          });
          return;
        }
        emit({
          group: selected.group,
          owner: selected.owner ?? defaultOwner(),
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
          lastRoute: selected.lastRoute ?? null,
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
            characters: data.characters ?? [],
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
          memberName: message.memberName ?? (message.role === 'user' ? state.owner?.name ?? '用户' : member?.name ?? '成员'),
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
          case 'route': {
            emit({ lastRoute: event.route });
            break;
          }
          case 'notice': {
            const exists = state.notices.some((notice) => notice.id === event.notice.id);
            emit({
              notices: exists
                ? state.notices.map((notice) => (notice.id === event.notice.id ? event.notice : notice))
                : [...state.notices, event.notice].slice(-20),
            });
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
          publishChange();
          flushSyncReload();
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
        publishChange();
      }

      /** @param {string} messageId - newest message. @returns {Promise<void>} completion. */
      async function rewrite(messageId) {
        if (state.busy || state.group === null) return;
        await stream('groupchat.rewrite', { messageId });
      }

      /** @param {string} noticeId - failed generation notice. @returns {Promise<void>} completion. */
      async function retryNotice(noticeId) {
        if (state.busy || state.group === null) return;
        await stream('groupchat.retry', { noticeId });
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
          publishChange();
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
        publishChange();
        return data.state.group;
      }

      /** @param {object} owner - complete owner profile. @returns {Promise<object>} saved owner. */
      async function saveOwner(owner) {
        if (state.group === null) throw new Error('没有选中的群。');
        const response = await fetch('api/groupchat.group-update', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ groupId: state.group.id, owner }),
        });
        if (!response.ok) throw new Error(await errorMessage(response));
        const data = await response.json();
        applySelected(data.state);
        publishChange();
        return data.state.owner;
      }

      /** Delete the selected group after the host verifies its full name. @returns {Promise<object>} result. */
      async function deleteGroup() {
        if (state.group === null) throw new Error('没有选中的群。');
        if (state.busy || state.activeTurn !== null) {
          throw new Error('正在生成，请先停止当前回应再删除。');
        }
        const response = await fetch('api/groupchat.group-delete', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ groupId: state.group.id, confirmName: state.group.name }),
        });
        if (!response.ok) throw new Error(await errorMessage(response));
        const data = await response.json();
        const remaining = state.groups.filter((group) => group.id !== state.group.id);
        writeSelected(null);
        emit({
          groups: remaining,
          selectedId: null,
          group: null,
          owner: defaultOwner(),
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
          streaming: null,
          busy: false,
          actionError: null,
          actionNotice: null,
        });
        await load(remaining[0]?.id ?? null);
        publishChange();
        return data;
      }

      /** @param {object} member - member fields, with memberId to edit. @returns {Promise<object>} saved member. */
      /**
       * Create or edit one global character.
       * @param {object} character - character fields.
       * @returns {Promise<object>} saved character.
       */
      async function saveCharacter(character) {
        const response = await fetch('api/groupchat.character-save', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(character),
        });
        if (!response.ok) throw new Error(await errorMessage(response));
        const data = await response.json();
        await load(state.selectedId);
        publishChange();
        return data.character;
      }

      /**
       * Delete one global character. Characters used by a group are refused.
       * @param {string} characterId - character id.
       * @returns {Promise<void>} completion.
       */
      async function deleteCharacter(characterId) {
        const response = await fetch('api/groupchat.character-delete', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ characterId }),
        });
        if (!response.ok) throw new Error(await errorMessage(response));
        await load(state.selectedId);
        publishChange();
      }

      /**
       * Add characters to the selected group.
       * @param {string[]} characterIds - character ids.
       * @returns {Promise<void>} completion.
       */
      async function addGroupCharacters(characterIds) {
        if (state.group === null) throw new Error('没有选中的群。');
        const response = await fetch('api/groupchat.group-characters', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ groupId: state.group.id, action: 'add', characterIds }),
        });
        if (!response.ok) throw new Error(await errorMessage(response));
        const data = await response.json();
        applySelected(data.state);
        await load(state.group.id);
        publishChange();
      }

      /**
       * Remove one character from the selected group; the character stays in
       * the library.
       * @param {string} characterId - character id.
       * @returns {Promise<void>} completion.
       */
      async function removeGroupCharacter(characterId) {
        if (state.group === null) throw new Error('没有选中的群。');
        const response = await fetch('api/groupchat.group-characters', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ groupId: state.group.id, action: 'remove', characterId }),
        });
        if (!response.ok) throw new Error(await errorMessage(response));
        const data = await response.json();
        applySelected(data.state);
        await load(state.group.id);
        publishChange();
      }

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
        publishChange();
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
        publishChange();
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

      /**
       * Export a group backup or one character card.
       * @param {{scope?: 'group'|'owner'|'member', memberId?: string, includeAvatars?: boolean}} options - export options.
       * @returns {Promise<object>} portable response.
       */
      async function exportPortable(options = {}) {
        if (state.group === null) throw new Error('没有选中的群。');
        const response = await fetch('api/groupchat.portable-export', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ groupId: state.group.id, ...options }),
        });
        if (!response.ok) throw new Error(await errorMessage(response));
        return response.json();
      }

      /** @param {string} text - JSON file text. @returns {Promise<object>} group import preview. */
      async function previewGroupImport(text) {
        const response = await fetch('api/groupchat.portable-group-preview', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        if (!response.ok) throw new Error(await errorMessage(response));
        return response.json();
      }

      /** @param {string} text - JSON file text. @returns {Promise<object>} imported group state. */
      async function importGroupBundle(text) {
        if (state.busy || state.activeTurn !== null) {
          throw new Error('正在生成回应，请先停止再导入新群。');
        }
        const response = await fetch('api/groupchat.portable-group-import', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        if (!response.ok) throw new Error(await errorMessage(response));
        const data = await response.json();
        writeSelected(data.groupId);
        emit({ loaded: true, loading: false, error: null });
        applySelected(data.state);
        await load(data.groupId);
        publishChange();
        return data;
      }

      /**
       * Parse a character card and map its relations onto the current group.
       * @param {string} text - JSON file text.
       * @param {'owner'|'member'} target - target form.
       * @param {string|null} [memberId] - member being edited, when any.
       * @returns {Promise<object>} normalized form fields.
       */
      async function previewCharacterImport(text, target, memberId = null) {
        if (target === 'character') {
          const response = await fetch('api/groupchat.character-preview', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text }),
          });
          if (!response.ok) throw new Error(await errorMessage(response));
          return response.json();
        }
        if (state.group === null) throw new Error('没有选中的群。');
        const response = await fetch('api/groupchat.portable-character-preview', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            groupId: state.group.id,
            target,
            ...(memberId === null ? {} : { memberId }),
            text,
          }),
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
        retryNotice,
        pin,
        saveGroup,
        saveOwner,
        saveMember,
        saveCharacter,
        deleteCharacter,
        addGroupCharacters,
        removeGroupCharacter,
        deleteGroup,
        createGroup,
        exportMarkdown,
        exportPortable,
        previewGroupImport,
        importGroupBundle,
        previewCharacterImport,
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
    /** @param {{size?: number}} props - size. @returns {any} search icon. */
    function IconSearch({ size = 14 }) {
      return h(Svg, { size }, h('circle', { cx: 10.5, cy: 10.5, r: 6.5 }), h('path', { d: 'M16 16l4.5 4.5' }));
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
    /** @param {{size?: number}} props - size. @returns {any} menu icon. */
    function IconMenu({ size = 18 }) {
      return h(Svg, { size }, h('path', { d: 'M4 7h16M4 12h16M4 17h16' }));
    }
    /** @param {{size?: number}} props - size. @returns {any} plus icon. */
    function IconPlus({ size = 14 }) {
      return h(Svg, { size }, h('path', { d: 'M12 5v14M5 12h14' }));
    }

    /**
     * Render body text with resolved `@` references highlighted.
     * @param {{text: string, members: Array<object>, ownerName: string}} props - text.
     * @returns {any} element.
     */
    function MentionText({ text, members, ownerName }) {
      const names = new Set(['群主', ownerName, ...members.map((member) => member.name)]);
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
    function Avatar({ name, color, owner = false, small = false, src = null }) {
      const image = typeof src === 'string' && /^data:image\/(png|jpeg|webp);base64,/i.test(src);
      return h(
        'span',
        {
          className: `mgc-av${small ? ' mgc-avSm' : ''}${owner ? ' mgc-avOwner' : ''}`,
          style: owner || image ? undefined : { background: color ?? '#6a7280' },
          'aria-hidden': true,
        },
        image ? h('img', { className: 'mgc-avImg', src, alt: '' }) : initialOf(name),
      );
    }

    /**
     * Read an image file and center-crop it into a 128×128 PNG data URL.
     * Keeping the avatar in `card.json` avoids a second binary route and keeps
     * the member card self-contained when the data directory is copied.
     * @param {File} file - chosen image.
     * @returns {Promise<string>} data URL.
     */
    function readAvatarFile(file) {
      return new Promise((resolve, reject) => {
        if (typeof file?.type === 'string' && !file.type.startsWith('image/')) {
          reject(new Error('请选择图片文件（PNG / JPEG / WebP）。'));
          return;
        }
        if (typeof file?.size === 'number' && file.size > 8 * 1024 * 1024) {
          reject(new Error('图片太大，请选择 8 MB 以内的图片。'));
          return;
        }
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
          try {
            const edge = 128;
            const canvas = document.createElement('canvas');
            canvas.width = edge;
            canvas.height = edge;
            const context = canvas.getContext('2d');
            if (context === null) throw new Error('浏览器无法处理图片。');
            const scale = Math.max(edge / image.width, edge / image.height);
            const width = image.width * scale;
            const height = image.height * scale;
            context.drawImage(image, (edge - width) / 2, (edge - height) / 2, width, height);
            resolve(canvas.toDataURL('image/png'));
          } catch (error) {
            reject(error);
          } finally {
            URL.revokeObjectURL(url);
          }
        };
        image.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('无法读取这张图片。'));
        };
        image.src = url;
      });
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
    function MessageRow({ message, members, owner: ownerProfile, t, continuation, canRewrite, busy, rewriting, focused, onPin, onRewrite }) {
      const [copied, setCopied] = useState(false);
      const timer = useRef(null);
      useEffect(() => () => clearTimeout(timer.current), []);
      const isOwner = message.role === 'user';
      const member = members.find((candidate) => candidate.id === message.memberId);
      const ownerName = ownerProfile?.name ?? t('messages.owner');
      const name = isOwner ? ownerName : member?.name ?? message.memberName ?? '成员';
      const color = isOwner ? null : avatarColor(members, message.memberId);
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
          className: `mgc-msg${isOwner ? ' mgc-msgOwner' : ''}${continuation ? ' mgc-msgCont' : ''}${message.folded ? ' mgc-foldMsg' : ''}${focused ? ' mgc-msgFocus' : ''}`,
          'data-message-id': message.id,
          'data-role': isOwner ? 'owner' : 'member',
        },
        h(Avatar, {
          name,
          color,
          owner: isOwner,
          src: isOwner ? ownerProfile?.avatar ?? null : member?.avatar ?? null,
        }),
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
          h(MentionText, { text: message.text, members, ownerName }),
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
    function TypingRow({ streaming, members, owner: ownerProfile }) {
      const t = useT();
      const stopped = streaming.stopped === true;
      return h(
        'article',
        { className: 'mgc-msg', 'aria-live': 'polite' },
        h(Avatar, {
          name: streaming.memberName,
          color: avatarColor(members, streaming.memberId),
          src: members.find((member) => member.id === streaming.memberId)?.avatar ?? null,
        }),
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
            ? h(MentionText, { text: streaming.text, members, ownerName: ownerProfile?.name ?? t('messages.owner') })
            : h('div', { className: 'mgc-text' }, h(TypingDots)),
        ),
      );
    }

    /**
     * One persisted notice (budget pause, failed generation, and similar).
     * @param {{notice: object, onRetry: Function, disabled: boolean}} props - notice and retry state.
     * @returns {any} element.
     */
    function NoticeRow({ notice, onRetry, disabled }) {
      const t = useT();
      const retry = notice.retry;
      return h(
        'div',
        { className: 'mgc-noticeRow' },
        h(
          'div',
          { className: `mgc-notice${notice.level === 'warn' ? ' mgc-noticeWarn' : ''}` },
          h('span', { 'aria-hidden': true }, '!'),
          h('span', { className: 'mgc-noticeText' }, notice.text),
          retry === undefined
            ? null
            : retry.resolved === true
              ? h('span', { className: 'mgc-noticeDone' }, t('notice.retried'))
              : h(
                  'button',
                  {
                    type: 'button',
                    className: 'mgc-noticeBtn',
                    onClick: () => onRetry(notice.id),
                    disabled,
                    title: t('notice.retryHint'),
                  },
                  t('retry'),
                ),
        ),
      );
    }

    /**
     * Conversation body: folded banner, messages and notices in time order,
     * and the live partial reply.
     * @param {object} props - thread inputs.
     * @returns {any} element.
     */
    function Thread({ state, t, showFolded, onToggleFolded, onPin, onRewrite, onRetry, focusId }) {
      const wrapRef = useRef(null);
      const stick = useRef(true);
      const messages = state.messages;
      const [renderCount, setRenderCount] = useState(300);
      useEffect(() => {
        setRenderCount(300);
      }, [state.group?.id, showFolded]);
      useEffect(() => {
        if (focusId === null) return;
        const index = messages.findIndex((message) => message.id === focusId);
        if (index < 0) return;
        setRenderCount((count) => Math.max(count, messages.length - index + 24));
      }, [focusId, messages.length]);
      const allVisible = showFolded ? messages : messages.filter((message) => !message.folded);
      const hiddenCount = Math.max(0, allVisible.length - renderCount);
      const visible = hiddenCount > 0 ? allVisible.slice(hiddenCount) : allVisible;
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
      useEffect(() => {
        if (focusId === null) return undefined;
        const timer = setTimeout(() => {
          const wrap = wrapRef.current;
          if (wrap === null) return;
          const target = wrap.querySelector(`[data-message-id="${focusId}"]`);
          if (target === null) return;
          const targetRect = target.getBoundingClientRect();
          const wrapRect = wrap.getBoundingClientRect();
          const top = wrap.scrollTop + targetRect.top - wrapRect.top
            - wrap.clientHeight / 2 + targetRect.height / 2;
          wrap.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
          stick.current = false;
        }, 80);
        return () => clearTimeout(timer);
      }, [focusId, renderCount]);
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
          hiddenCount > 0
            ? h(
                'div',
                { className: 'mgc-foldBar' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'mgc-foldBtn',
                    onClick: () => setRenderCount((count) => count + 300),
                  },
                  t('messages.showEarlier', { n: hiddenCount }),
                  h(IconChevron, { size: 11 }),
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
            if (item.kind === 'notice') {
              return h(NoticeRow, {
                key: `n_${item.notice.id}`,
                notice: item.notice,
                onRetry,
                disabled: state.busy,
              });
            }
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
              owner: state.owner,
              t,
              continuation,
              canRewrite: message.role === 'member'
                && message.id === state.latestMemberMessageId
                && message.folded !== true,
              busy: state.busy,
              rewriting: state.rewritingId === message.id,
              focused: focusId === message.id,
              onPin,
              onRewrite,
            });
          }),
          state.streaming !== null
            ? h(TypingRow, {
                streaming: state.streaming,
                members: state.members,
                owner: state.owner,
                key: 'streaming',
              })
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
      const ownerName = state.owner?.name ?? t('messages.owner');
      const mentionItems = [
        ...state.members,
        { id: '__owner__', name: ownerName, avatar: state.owner?.avatar ?? null, public: { oneLiner: t('composer.owner') } },
      ];
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
                            src: member.id === '__owner__' ? state.owner?.avatar ?? null : member.avatar ?? null,
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
     * Left rail: every group, with a last-message preview and a new-group action.
     * @param {{state: object, t: object, onSelect: Function, onNew: Function, disabled: boolean}} props - rail inputs.
     * @returns {any} element.
     */
    function GroupRail({ state, t, onSelect, onNew, disabled }) {
      const groups = state.groups ?? [];
      return h(
        'aside',
        { className: 'mgc-rail', id: 'mgc-rail', 'aria-label': t('rail.title') },
        h(
          'div',
          { className: 'mgc-railHead' },
          h('div', { className: 'mgc-railEyebrow' }, 'DSH / GROUP CHAT'),
          h('div', { className: 'mgc-railTitleRow' },
            h('h2', { className: 'mgc-railTitle' }, t('rail.title')),
            h('span', { className: 'mgc-railCount' }, t('rail.count', { n: groups.length })),
          ),
        ),
        h(
          'div',
          { className: 'mgc-railList' },
          groups.map((group) => {
            const active = group.id === state.selectedId;
            const preview = group.lastMessageText
              ? `${group.lastMessageSpeaker ? `${group.lastMessageSpeaker}：` : ''}${group.lastMessageText}`
              : group.brief?.trim() || t('rail.noMessages');
            return h(
              'button',
              {
                key: group.id,
                type: 'button',
                className: 'mgc-railRow',
                'data-active': active ? 'true' : 'false',
                'aria-current': active ? 'page' : undefined,
                disabled: disabled && !active,
                onClick: () => onSelect(group.id),
              },
              h('span', { className: 'mgc-railAvatar' }, h(Avatar, { name: group.name, color: groupColor(group.name) })),
              h(
                'span',
                { className: 'mgc-railText' },
                h(
                  'span',
                  { className: 'mgc-railTop' },
                  h('span', { className: 'mgc-railName' }, group.name),
                  group.lastMessageAt > 0 ? h('span', { className: 'mgc-railTime' }, fmtTime(group.lastMessageAt)) : null,
                ),
                h('span', { className: 'mgc-railPreview' }, preview),
                h(
                  'span',
                  { className: 'mgc-railMeta' },
                  t('header.members', { n: group.memberCount }),
                  group.messageCount > 0 ? ` · ${t('rail.messages', { n: group.messageCount })}` : '',
                ),
              ),
            );
          }),
        ),
        h(
          'div',
          { className: 'mgc-railFoot' },
          h(
            'button',
            { type: 'button', className: 'mgc-railNew', onClick: onNew, disabled },
            h(IconPlus, { size: 14 }),
            t('rail.new'),
          ),
          h('div', { className: 'mgc-railHint' }, t('rail.hint')),
        ),
      );
    }

    /**
     * Header: active group, status summary, and management actions.
     * @param {object} props - header inputs.
     * @returns {any} element.
     */
    function Header({ state, t, onOpen, onToggleRail, onSearch, searchOpen, railOpen }) {
      const model = state.defaultModel;
      const modelText = model === null ? t('group.noDefaultModel') : `${model.provider} / ${model.model}`;
      const used = state.totals.inputTokens + state.totals.outputTokens;
      const max = state.budget?.maxInputTokens ?? 0;
      const ratio = max > 0 ? Math.min(1, used / max) : 0;
      const scene = typeof state.group.scene === 'string' ? state.group.scene.trim() : '';
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
              'button',
              {
                type: 'button',
                className: 'mgc-railToggle',
                onClick: onToggleRail,
                'aria-expanded': railOpen,
                'aria-controls': 'mgc-rail',
                'aria-label': t('header.openRail'),
              },
              h(IconMenu, { size: 18 }),
            ),
            h('h1', { className: 'mgc-groupTitle' }, state.group.name),
            h('span', { className: 'mgc-live' }, h('i'), t('header.live')),
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
            scene.length > 0 ? h('span', { className: 'mgc-dot' }) : null,
            scene.length > 0
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'mgc-sceneChip',
                    onClick: () => onOpen('group'),
                    title: t('header.sceneEdit'),
                  },
                  t('header.scene', {
                    scene: [...scene].length > 36 ? `${[...scene].slice(0, 36).join('')}…` : scene,
                  }),
                )
              : null,
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
            {
              type: 'button',
              className: 'mgc-iconBtn',
              onClick: onSearch,
              title: t('search.open'),
              'aria-label': t('search.open'),
              'aria-expanded': searchOpen,
            },
            h(IconSearch, { size: 16 }),
          ),
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
     * Highlighted snippet for one search result.
     * @param {{result: object, query: string}} props - result and raw query.
     * @returns {any} element.
     */
    function SearchSnippet({ result, query }) {
      const needle = query.trim();
      const start = Math.max(0, result.at - 28);
      const end = Math.min(result.text.length, result.at + needle.length + 44);
      return h(
        'span',
        { className: 'mgc-searchSnippet' },
        start > 0 ? '…' : '',
        result.text.slice(start, result.at),
        h('mark', null, result.text.slice(result.at, result.at + needle.length)),
        result.text.slice(result.at + needle.length, end),
        end < result.text.length ? '…' : '',
      );
    }

    /**
     * Inline search over the current group's full effective history.
     * @param {object} props - search state and handlers.
     * @returns {any} element.
     */
    function SearchPanel({ state, t, query, onQuery, memberFilter, onMemberFilter, onClose, onJump }) {
      const input = useRef(null);
      useEffect(() => {
        input.current?.focus();
      }, []);
      const results = useMemo(
        () => searchMessages(state.messages, query, memberFilter, state.owner?.name ?? t('messages.owner')),
        [state.messages, query, memberFilter, state.owner?.name, t],
      );
      const hasQuery = query.trim().length > 0;
      return h(
        'section',
        { className: 'mgc-searchPanel', role: 'search', 'aria-label': t('search.open') },
        h(
          'div',
          { className: 'mgc-searchRow' },
          h(IconSearch, { size: 15 }),
          h('input', {
            ref: input,
            className: 'mgc-searchInput',
            value: query,
            onChange: (event) => onQuery(event.target.value),
            onKeyDown: (event) => {
              if (event.key === 'Escape') onClose();
            },
            placeholder: t('search.placeholder'),
            'aria-label': t('search.placeholder'),
          }),
          h(
            'button',
            { type: 'button', className: 'mgc-iconBtn', onClick: onClose, title: t('search.close'), 'aria-label': t('search.close') },
            h(IconClose, { size: 15 }),
          ),
        ),
        h(
          'div',
          { className: 'mgc-searchMeta' },
          h(
            'select',
            {
              className: 'mgc-select mgc-searchSelect',
              value: memberFilter,
              onChange: (event) => onMemberFilter(event.target.value),
              'aria-label': t('search.all'),
            },
            h('option', { value: 'all' }, t('search.all')),
            h('option', { value: 'owner' }, t('search.owner')),
            state.members.map((member) => h('option', { key: member.id, value: member.id }, member.name)),
          ),
          h('span', { className: 'mgc-hint' }, hasQuery ? t('search.results', { n: results.length }) : t('search.hint')),
        ),
        !hasQuery
          ? null
          : results.length === 0
            ? h('div', { className: 'mgc-searchEmpty' }, t('search.empty'))
            : h(
                'div',
                { className: 'mgc-searchResults' },
                results.map((result) =>
                  h(
                    'button',
                    {
                      key: result.id,
                      type: 'button',
                      className: 'mgc-searchResult',
                      onClick: () => onJump(result.id),
                      title: t('search.jump'),
                    },
                    h(
                      'span',
                      { className: 'mgc-searchResultHead' },
                      h('span', { className: 'mgc-searchName' }, result.name),
                      h('span', { className: 'mgc-searchTime' }, fmtTime(result.ts, true)),
                      result.folded ? h('span', { className: 'mgc-tag' }, t('search.folded')) : null,
                    ),
                    h(SearchSnippet, { result, query }),
                  ),
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
      const [railOpen, setRailOpen] = useState(false);
      const [searchOpen, setSearchOpen] = useState(false);
      const [searchQuery, setSearchQuery] = useState('');
      const [searchMember, setSearchMember] = useState('all');
      const [focusId, setFocusId] = useState(null);
      useEffect(() => {
        store.load();
      }, [store]);
      useEffect(() => {
        setShowFolded(false);
        setDrawer(null);
        setRailOpen(false);
        setSearchOpen(false);
        setSearchQuery('');
        setSearchMember('all');
        setFocusId(null);
      }, [state.group?.id]);
      useEffect(() => {
        if (focusId === null) return undefined;
        const timer = setTimeout(() => setFocusId(null), 4000);
        return () => clearTimeout(timer);
      }, [focusId]);
      const jumpToMessage = (messageId) => {
        if (!state.messages.some((message) => message.id === messageId)) return;
        setSearchOpen(false);
        setShowFolded(true);
        setFocusId(messageId);
      };
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
          state,
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
          state,
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
        { className: 'mgc-page', 'aria-label': t('panel'), 'data-rail': railOpen ? 'open' : 'closed' },
        h(GroupRail, {
          state,
          t,
          disabled: uiBusy,
          onSelect: (groupId) => {
            setRailOpen(false);
            if (groupId !== state.group.id) store.selectGroup(groupId);
          },
          onNew: () => {
            setRailOpen(false);
            setCreating(true);
          },
        }),
        railOpen
          ? h('div', { className: 'mgc-railBackdrop', onClick: () => setRailOpen(false), 'aria-hidden': true })
          : null,
        h(
          'div',
          { className: 'mgc-main' },
          h(Header, {
            state,
            t,
            onOpen: (kind) => setDrawer(kind),
            onToggleRail: () => setRailOpen((open) => !open),
            onSearch: () => setSearchOpen((open) => !open),
            searchOpen,
            railOpen,
          }),
          searchOpen
            ? h(SearchPanel, {
                state,
                t,
                query: searchQuery,
                onQuery: setSearchQuery,
                memberFilter: searchMember,
                onMemberFilter: setSearchMember,
                onClose: () => setSearchOpen(false),
                onJump: jumpToMessage,
              })
            : null,
          h(Thread, {
            state: uiState,
            t,
            showFolded,
            onToggleFolded: () => setShowFolded((open) => !open),
            onPin: (messageId, pinned) => store.pin(messageId, pinned),
            onRewrite: (messageId) => store.rewrite(messageId),
            onRetry: (noticeId) => store.retryNotice(noticeId),
            focusId,
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
        ),
      );
    }

    /**
     * Shared read-only model hint plus optional provider/model override inputs.
     * @param {object} props - model inputs.
     * @returns {any} element.
     */
    function ModelFields({
      t,
      inherit,
      onInherit,
      provider,
      model,
      onProvider,
      onModel,
      defaultModel,
      catalog,
      catalogError = null,
      onReload,
      idPrefix,
    }) {
      const providers = catalog?.providers ?? [];
      const providerOptions = [...providers];
      if (provider.length > 0 && !providers.some((item) => item.id === provider)) {
        providerOptions.unshift({ id: provider, name: `${provider} · ${t('group.modelCurrent')}`, models: [] });
      }
      const selected = providers.find((item) => item.id === provider);
      const models = selected?.models ?? [];
      const modelOptions = [...models];
      if (model.length > 0 && !models.some((entry) => entry.id === model)) {
        modelOptions.unshift({ id: model, name: `${model} · ${t('group.modelCurrent')}` });
      }
      const loading = catalog === null && catalogError === null;
      const canSelectProvider = catalog !== null && providerOptions.length > 0;
      const providerError = typeof selected?.error === 'string' ? selected.error : null;
      const optionLabel = (entry) => (entry.name && entry.name !== entry.id ? `${entry.name} · ${entry.id}` : entry.id);
      const modelFallback = !loading && (
        catalog === null
        || !canSelectProvider
        || (selected !== undefined && models.length === 0)
        || (provider.length > 0 && selected === undefined)
      );
      const chooseProvider = (event) => {
        const next = event.target.value;
        onProvider(next);
        if (next === '') {
          onModel('');
          return;
        }
        const entry = providers.find((item) => item.id === next);
        if (entry === undefined) return;
        if ((entry.models ?? []).length === 0) {
          onModel('');
          return;
        }
        if (!(entry.models ?? []).some((candidate) => candidate.id === model)) {
          onModel(entry.models[0].id);
        }
      };
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
                loading
                  ? h(
                      'select',
                      { className: 'mgc-select', id: `${idPrefix}-provider`, disabled: true },
                      h('option', { value: '' }, t('group.modelLoading')),
                    )
                  : canSelectProvider
                    ? h(
                        'select',
                        {
                          id: `${idPrefix}-provider`,
                          className: 'mgc-select',
                          value: provider,
                          onChange: chooseProvider,
                        },
                        h('option', { value: '' }, t('group.modelSelectPlaceholder')),
                        providerOptions.map((item) =>
                          h('option', { key: item.id, value: item.id }, optionLabel(item)),
                        ),
                      )
                    : h('input', {
                        id: `${idPrefix}-provider`,
                        className: 'mgc-input',
                        value: provider,
                        onChange: (event) => onProvider(event.target.value),
                        placeholder: 'deepseek',
                        spellCheck: false,
                      }),
              ),
              h(
                'div',
                { className: 'mgc-field', style: { marginBottom: 0 } },
                h('label', { className: 'mgc-label', htmlFor: `${idPrefix}-model` }, t('group.modelId')),
                loading
                  ? h(
                      'select',
                      { className: 'mgc-select', id: `${idPrefix}-model`, disabled: true },
                      h('option', { value: '' }, t('group.modelLoading')),
                    )
                  : modelFallback
                    ? h('input', {
                        id: `${idPrefix}-model`,
                        className: 'mgc-input',
                        value: model,
                        onChange: (event) => onModel(event.target.value),
                        placeholder: 'deepseek-chat',
                        spellCheck: false,
                      })
                    : h(
                        'select',
                        {
                          id: `${idPrefix}-model`,
                          className: 'mgc-select',
                          value: model,
                          onChange: (event) => onModel(event.target.value),
                          disabled: provider.length === 0,
                        },
                        h('option', { value: '' }, t('group.modelSelectPlaceholder')),
                        modelOptions.map((entry) =>
                          h('option', { key: entry.id, value: entry.id }, optionLabel(entry)),
                        ),
                      ),
              ),
            ),
        catalogError !== null
          ? h(
              'div',
              { className: 'mgc-error', style: { marginTop: '8px' } },
              t('group.modelCatalogError', { message: catalogError }),
              typeof onReload === 'function'
                ? h(
                    'button',
                    { type: 'button', className: 'mgc-btn', style: { marginLeft: '8px' }, onClick: onReload },
                    t('group.modelRetry'),
                  )
                : null,
            )
          : null,
        catalog !== null && providers.length === 0
          ? h('div', { className: 'mgc-warnText', style: { marginTop: '6px' } }, t('group.modelNoProviders'))
          : null,
        catalog !== null && selected !== undefined && models.length === 0
          ? h(
              'div',
              { className: 'mgc-warnText', style: { marginTop: '6px' } },
              `${t('group.modelNoModels')}${providerError === null ? '' : ` ${providerError}`}`,
            )
          : null,
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
          scene: group.scene ?? '',
          smartRouting: group.policy.smartRouting !== false,
          maxMentionReplies: group.policy.maxMentionReplies,
          bystanderChance: group.policy.bystanderChance ?? 30,
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
          setError(t('group.modelRequired'));
          return;
        }
        setSaving(true);
        setError(null);
        setSaved(false);
        try {
          await store.saveGroup({
            name: draft.name.trim(),
            brief: draft.brief,
            scene: draft.scene,
            policy: {
              smartRouting: draft.smartRouting,
              maxMentionReplies: Number(draft.maxMentionReplies),
              bystanderChance: Number(draft.bystanderChance),
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
      const route = state.lastRoute;
      const routeNames = (ids) => (Array.isArray(ids) && ids.length > 0
        ? ids.map((id) => state.members.find((member) => member.id === id)?.name ?? id).join('、')
        : t('common.none'));
      const numberField = (key, label, options = {}) =>
        h(
          'div',
          { className: 'mgc-field' },
          h('label', { className: 'mgc-label', htmlFor: `mgc-${key}` }, label),
          h('input', {
            id: `mgc-${key}`,
            className: 'mgc-input',
            type: 'number',
            min: options.min ?? 0,
            ...(options.max === undefined ? {} : { max: options.max }),
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
        h(
          'div',
          { className: 'mgc-field' },
          h('label', { className: 'mgc-label', htmlFor: 'mgc-group-scene' }, t('group.scene')),
          h('textarea', {
            id: 'mgc-group-scene',
            className: 'mgc-textarea2',
            value: draft.scene,
            maxLength: 800,
            onChange: (event) => patch('scene', event.target.value),
            placeholder: t('group.scenePlaceholder'),
          }),
          h('div', { className: 'mgc-hint' }, t('group.sceneHint')),
        ),
        h('div', { className: 'mgc-label', style: { margin: '4px 0 8px' } }, t('group.policyTitle')),
        h(
          'label',
          { className: 'mgc-check', style: { marginBottom: '6px' } },
          h('input', {
            type: 'checkbox',
            checked: draft.smartRouting,
            onChange: (event) => patch('smartRouting', event.target.checked),
          }),
          t('group.smartRouting'),
        ),
        h('div', { className: 'mgc-hint', style: { marginBottom: '12px' } }, t('group.smartRoutingHint')),
        h(
          'div',
          { className: 'mgc-row2' },
          numberField('maxMentionReplies', t('group.maxMentionReplies'), { min: 1, max: 3 }),
          numberField('bystanderChance', t('group.bystanderChance'), { min: 0, max: 100 }),
          numberField('maxHandoffDepth', t('group.maxHandoffDepth'), { min: 0, max: 3 }),
          numberField('maxHistory', t('group.maxHistory'), { min: 1 }),
          numberField('maxPinned', t('group.maxPinned'), { min: 0 }),
          numberField('maxReplyChars', t('group.maxReplyChars'), { min: 20 }),
          h(
            'div',
            { className: 'mgc-field' },
            h('label', { className: 'mgc-label' }, t('group.replyMode')),
            h('div', { className: 'mgc-hint', style: { paddingTop: '7px' } }, t('group.replyModeValue')),
          ),
        ),
        h('div', { className: 'mgc-hint', style: { marginBottom: '8px' } }, t('group.bystanderChanceHint')),
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
          catalogError: state.modelsError,
          onReload: () => store.loadModels(),
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
          h('div', { className: 'mgc-label' }, t('group.lastRoute')),
          route === null
            ? h('div', { className: 'mgc-hint' }, t('group.lastRouteNone'))
            : h(
                'div',
                { className: 'mgc-routeDiag' },
                h('div', null, t('group.routeTargets', { names: routeNames(route.targets) })),
                h('div', null, t('group.routeBystanders', { names: routeNames(route.bystanders) })),
                h('div', null, t('group.routeMethod', { method: t(`route.method.${route.method}`) })),
                route.reason ? h('div', { className: 'mgc-hint' }, t('group.routeReason', { reason: route.reason })) : null,
              ),
        ),
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
        h('div', { className: 'mgc-dangerZone' }, h(DeleteGroupCard, { state, t, store })),
      );
    }

    /**
     * Dangerous group deletion, gated by typing the exact group name.
     * @param {{state: object, t: object, store: object}} props - deletion inputs.
     * @returns {any} element.
     */
    function DeleteGroupCard({ state, t, store }) {
      const group = state.group;
      const busy = state.busy || state.activeTurn !== null;
      const inputId = useRef(`mgc-delete-${Math.random().toString(36).slice(2, 7)}`).current;
      const [confirming, setConfirming] = useState(false);
      const [typed, setTyped] = useState('');
      const [deleting, setDeleting] = useState(false);
      const [error, setError] = useState(null);
      const remove = async () => {
        if (typed !== group.name) return;
        setDeleting(true);
        setError(null);
        try {
          await store.deleteGroup();
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : String(reason));
          setDeleting(false);
        }
      };
      return h(
        'div',
        null,
        h('h4', { className: 'mgc-dangerTitle' }, t('group.deleteTitle')),
        h('p', { className: 'mgc-dangerDesc' }, t('group.deleteDesc')),
        busy ? h('p', { className: 'mgc-warnText' }, t('group.deleteBusy')) : null,
        confirming
          ? h(
              'div',
              { className: 'mgc-deleteConfirm' },
              h('p', { className: 'mgc-dangerWarning' }, t('group.deleteWarning')),
              h('label', { className: 'mgc-label', htmlFor: inputId }, t('group.deleteConfirmLabel', { name: group.name })),
              h('input', {
                id: inputId,
                className: 'mgc-input',
                value: typed,
                onChange: (event) => setTyped(event.target.value),
                placeholder: group.name,
                autoFocus: true,
                spellCheck: false,
              }),
              error !== null ? h('p', { className: 'mgc-error', style: { marginTop: '8px' } }, error) : null,
              h(
                'div',
                { className: 'mgc-formActions' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'mgc-btn',
                    disabled: deleting,
                    onClick: () => {
                      setConfirming(false);
                      setTyped('');
                      setError(null);
                    },
                  },
                  t('common.cancel'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'mgc-btn mgc-btnDanger',
                    disabled: typed !== group.name || deleting,
                    onClick: remove,
                  },
                  deleting ? t('group.deleting') : t('group.deleteConfirm'),
                ),
              ),
            )
          : h(
              'button',
              {
                type: 'button',
                className: 'mgc-btn mgc-btnDanger',
                disabled: busy,
                onClick: () => {
                  setConfirming(true);
                  setError(null);
                },
              },
              t('group.deleteButton'),
            ),
      );
    }

    /**
     * Avatar picker with preview and remove control, shared by member and owner forms.
     * @param {object} props - picker props.
     * @returns {any} element.
     */
    function AvatarField({ t, avatar, name, color = null, owner = false, onChange }) {
      const [error, setError] = useState(null);
      const input = useRef(null);
      const choose = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file === undefined) return;
        try {
          onChange(await readAvatarFile(file));
          setError(null);
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      };
      return h(
        'div',
        { className: 'mgc-field' },
        h('div', { className: 'mgc-label' }, t('members.avatar')),
        h(
          'div',
          { className: 'mgc-avatarRow' },
          h(Avatar, { name: name || '?', color, owner, src: avatar }),
          h(
            'div',
            { style: { minWidth: 0 } },
            h(
              'div',
              { className: 'mgc-avatarActions' },
              h(
                'button',
                { type: 'button', className: 'mgc-btn', onClick: () => input.current?.click() },
                t('members.avatarChoose'),
              ),
              avatar.length === 0
                ? null
                : h(
                    'button',
                    { type: 'button', className: 'mgc-btn mgc-btnDanger', onClick: () => onChange('') },
                    t('members.avatarRemove'),
                  ),
            ),
            h('div', { className: 'mgc-avatarHint', style: { marginTop: '6px' } }, t('members.avatarHint')),
            error !== null ? h('div', { className: 'mgc-error', style: { marginTop: '4px' } }, error) : null,
          ),
        ),
        h('input', {
          ref: input,
          type: 'file',
          accept: 'image/png,image/jpeg,image/webp',
          style: { display: 'none' },
          onChange: choose,
        }),
      );
    }

    /**
     * One member edit form.
     * @param {object} props - form inputs.
     * @returns {any} element.
     */
    function MemberForm({ member, members, state, t, store, onDone, onCancel, mode = 'member' }) {
      const library = mode === 'character';
      const others = members.filter((candidate) => candidate.id !== member?.id);
      const [name, setName] = useState(member?.name ?? '');
      const [avatar, setAvatar] = useState(member?.avatar ?? '');
      const [oneLiner, setOneLiner] = useState(member?.public?.oneLiner ?? '');
      const [style, setStyle] = useState(member?.style ?? '');
      const [relations, setRelations] = useState(() => ({ ...(member?.public?.relations ?? {}) }));
      const [privateRelations, setPrivateRelations] = useState(() => ({ ...(member?.privateRelations ?? {}) }));
      const [memory, setMemory] = useState(member?.memory ?? '');
      const [includePrivateExport, setIncludePrivateExport] = useState(false);
      const [core, setCore] = useState(member?.core ?? '');
      const [extended, setExtended] = useState(member?.extended ?? '');
      const [extendedEnabled, setExtendedEnabled] = useState(member?.extendedEnabled === true);
      const [inheritModel, setInheritModel] = useState(member?.model === null || member?.model === undefined);
      const [provider, setProvider] = useState(member?.model?.provider ?? state.defaultModel?.provider ?? '');
      const [model, setModel] = useState(member?.model?.model ?? state.defaultModel?.model ?? '');
      const [saving, setSaving] = useState(false);
      const [error, setError] = useState(null);
      const [cardBusy, setCardBusy] = useState(false);
      const [cardMessage, setCardMessage] = useState(null);
      const cardInput = useRef(null);
      const uid = useRef(`mgc-member-${Math.random().toString(36).slice(2, 7)}`);
      useEffect(() => {
        store.loadModels();
      }, [store]);
      const coreLength = [...core].length;
      const extendedLength = [...extended].length;
      const styleLength = [...style].length;
      const memoryLength = [...memory].length;
      const clearMemory = () => {
        if (memory.length === 0) return;
        if (!window.confirm(t('members.memoryClearConfirm'))) return;
        setMemory('');
      };
      const exportCard = async () => {
        if (member === null || library) return;
        setCardBusy(true);
        setCardMessage(null);
        try {
          const result = await store.exportPortable({
            scope: 'member',
            memberId: member.id,
            includeAvatars: true,
            includePrivate: includePrivateExport,
          });
          downloadText(result.filename, `${JSON.stringify(result.data, null, 2)}\n`);
          setCardMessage({ level: 'success', text: t('portable.characterExported') });
        } catch (reason) {
          setCardMessage({ level: 'error', text: reason instanceof Error ? reason.message : String(reason) });
        } finally {
          setCardBusy(false);
        }
      };
      const importCard = async (event) => {
        if (library) return;
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file === undefined) return;
        if (file.size > PORTABLE_FILE_LIMIT) {
          setCardMessage({ level: 'error', text: t('portable.tooLarge') });
          return;
        }
        setCardBusy(true);
        setCardMessage(null);
        setError(null);
        try {
          const result = await store.previewCharacterImport(await file.text(), 'member', member?.id ?? null);
          const fields = result.fields;
          setName(fields.name ?? '');
          setAvatar(fields.avatar ?? '');
          setOneLiner(fields.oneLiner ?? '');
          setStyle(fields.style ?? '');
          setRelations({ ...(fields.relations ?? {}) });
          setPrivateRelations({ ...(fields.privateRelations ?? {}) });
          setMemory(fields.memory ?? '');
          setCore(fields.core ?? '');
          setExtended(fields.extended ?? '');
          setExtendedEnabled(fields.extendedEnabled === true);
          setInheritModel(fields.model === null || fields.model === undefined);
          setProvider(fields.model?.provider ?? state.defaultModel?.provider ?? '');
          setModel(fields.model?.model ?? state.defaultModel?.model ?? '');
          setCardMessage({
            level: 'success',
            text: t('portable.characterLoaded'),
            warnings: result.warnings ?? [],
          });
        } catch (reason) {
          setCardMessage({ level: 'error', text: reason instanceof Error ? reason.message : String(reason) });
        } finally {
          setCardBusy(false);
        }
      };
      const save = async () => {
        if (name.trim().length === 0) {
          setError(t('members.name'));
          return;
        }
        if (!inheritModel && (provider.trim().length === 0 || model.trim().length === 0)) {
          setError(t('group.modelRequired'));
          return;
        }
        setSaving(true);
        setError(null);
        try {
          const fields = {
            name: name.trim(),
            avatar,
            oneLiner,
            style,
            relations,
            privateRelations,
            memory,
            core,
            extended,
            extendedEnabled,
            model: inheritModel ? null : { provider: provider.trim(), model: model.trim() },
          };
          if (library) {
            await store.saveCharacter({ ...(member === null ? {} : { id: member.id }), ...fields });
          } else {
            await store.saveMember({
              ...(member === null ? {} : { memberId: member.id }),
              ...fields,
            });
          }
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
        library
          ? h('div', { className: 'mgc-hint', style: { marginBottom: '10px' } }, t('members.libraryHint'))
          : h(
              'div',
              { className: 'mgc-formActions', style: { justifyContent: 'flex-start', marginBottom: '8px' } },
              member === null
                ? null
                : h(
                    'button',
                    { type: 'button', className: 'mgc-btn', onClick: exportCard, disabled: cardBusy },
                    h(IconDownload, { size: 12 }),
                    t('portable.characterExport'),
                  ),
              h(
                'button',
                { type: 'button', className: 'mgc-btn', onClick: () => cardInput.current?.click(), disabled: cardBusy },
                cardBusy ? t('portable.reading') : t('portable.characterImport'),
              ),
            ),
        library
          ? null
          : h('input', {
              ref: cardInput,
              type: 'file',
              accept: '.json,application/json',
              style: { display: 'none' },
              onChange: importCard,
            }),
        library || member === null
          ? null
          : h(
              'div',
              { style: { marginBottom: '10px' } },
              h(
                'label',
                { className: 'mgc-check' },
                h('input', {
                  type: 'checkbox',
                  checked: includePrivateExport,
                  onChange: (event) => setIncludePrivateExport(event.target.checked),
                }),
                t('members.privateExport'),
              ),
              h('div', { className: 'mgc-hint' }, t('members.privateExportHint')),
              includePrivateExport ? h('div', { className: 'mgc-privateWarning' }, t('portable.privateWarning')) : null,
            ),
        library ? null : h('div', { className: 'mgc-hint', style: { marginBottom: '10px' } }, t('portable.characterHint')),
        cardMessage === null
          ? null
          : h(
              'div',
              { className: cardMessage.level === 'error' ? 'mgc-error' : 'mgc-success' },
              cardMessage.text,
              cardMessage.warnings?.length > 0
                ? h('div', { className: 'mgc-warnText' }, `${t('portable.warnings')} ${cardMessage.warnings.join(' ')}`)
                : null,
            ),
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
        h(
          'div',
          { className: 'mgc-field' },
          h('label', { className: 'mgc-label', htmlFor: 'mgc-member-style' }, t('members.style')),
          h('textarea', {
            id: 'mgc-member-style',
            className: 'mgc-textarea2',
            value: style,
            maxLength: 300,
            onChange: (event) => setStyle(event.target.value),
            placeholder: t('members.stylePlaceholder'),
          }),
          h('div', { className: 'mgc-hint' }, t('members.styleCount', { n: styleLength })),
          h('div', { className: 'mgc-hint' }, t('members.styleHint')),
        ),
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
          { className: 'mgc-formSection' },
          h('div', { className: 'mgc-label' }, t('common.optional')),
          h('div', { className: 'mgc-hint' }, t('members.optionalHint')),
        ),
        h(AvatarField, {
          t,
          avatar,
          name: name || '?',
          color: avatarColor(members, member?.id),
          onChange: setAvatar,
        }),
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
        others.length > 0
          ? h(
              'div',
              { className: 'mgc-field' },
              h('div', { className: 'mgc-label' }, t('members.privateRelations')),
              others.map((other) =>
                h(
                  'div',
                  { key: other.id, style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' } },
                  h('span', { className: 'mgc-hint', style: { width: '96px', flex: 'none' } }, t('members.privateRelationWith', { name: other.name })),
                  h('input', {
                    className: 'mgc-input',
                    value: privateRelations[other.id] ?? '',
                    maxLength: 200,
                    onChange: (event) => setPrivateRelations((current) => ({ ...current, [other.id]: event.target.value })),
                    placeholder: t('common.none'),
                  }),
                ),
              ),
              h('div', { className: 'mgc-hint' }, t('members.privateRelationsHint')),
            )
          : null,
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
          h(
            'div',
            { className: 'mgc-memoryHead' },
            h('label', { className: 'mgc-label', htmlFor: 'mgc-member-memory' }, t('members.memory')),
            h(
              'button',
              {
                type: 'button',
                className: 'mgc-btn mgc-btnDanger mgc-btnSmall',
                onClick: clearMemory,
                disabled: memoryLength === 0,
              },
              t('members.memoryClear'),
            ),
          ),
          h('textarea', {
            id: 'mgc-member-memory',
            className: 'mgc-textarea2',
            value: memory,
            maxLength: 4000,
            onChange: (event) => setMemory(event.target.value),
            placeholder: t('members.memoryPlaceholder'),
          }),
          h('div', { className: 'mgc-hint' }, t('members.memoryCount', { n: memoryLength })),
          h('div', { className: 'mgc-hint' }, t('members.memoryHint')),
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
            catalogError: state.modelsError,
            onReload: () => store.loadModels(),
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
     * Owner profile form: public name, one-liner, per-turn setting, relations, avatar.
     * @param {{state: object, t: object, store: object}} props - owner inputs.
     * @returns {any} element.
     */
    function OwnerForm({ state, t, store }) {
      const owner = state.owner ?? defaultOwner();
      const members = state.members;
      const uid = useRef(`mgc-owner-${Math.random().toString(36).slice(2, 7)}`);
      const [name, setName] = useState(owner.name ?? '用户');
      const [avatar, setAvatar] = useState(owner.avatar ?? '');
      const [oneLiner, setOneLiner] = useState(owner.oneLiner ?? '');
      const [setting, setSetting] = useState(owner.setting ?? '');
      const [relations, setRelations] = useState(() => ({ ...(owner.relations ?? {}) }));
      const [saving, setSaving] = useState(false);
      const [error, setError] = useState(null);
      const [saved, setSaved] = useState(false);
      const [cardBusy, setCardBusy] = useState(false);
      const [cardMessage, setCardMessage] = useState(null);
      const cardInput = useRef(null);
      const settingLength = [...setting].length;
      const exportCard = async () => {
        setCardBusy(true);
        setCardMessage(null);
        try {
          const result = await store.exportPortable({ scope: 'owner', includeAvatars: true });
          downloadText(result.filename, `${JSON.stringify(result.data, null, 2)}\n`);
          setCardMessage({ level: 'success', text: t('portable.characterExported') });
        } catch (reason) {
          setCardMessage({ level: 'error', text: reason instanceof Error ? reason.message : String(reason) });
        } finally {
          setCardBusy(false);
        }
      };
      const importCard = async (event) => {
        if (library) return;
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file === undefined) return;
        if (file.size > PORTABLE_FILE_LIMIT) {
          setCardMessage({ level: 'error', text: t('portable.tooLarge') });
          return;
        }
        setCardBusy(true);
        setCardMessage(null);
        setError(null);
        setSaved(false);
        try {
          const result = await store.previewCharacterImport(await file.text(), 'owner');
          const fields = result.fields;
          setName(fields.name ?? '用户');
          setAvatar(fields.avatar ?? '');
          setOneLiner(fields.oneLiner ?? '');
          setSetting(fields.setting ?? '');
          setRelations({ ...(fields.relations ?? {}) });
          setCardMessage({
            level: 'success',
            text: t('portable.characterLoaded'),
            warnings: result.warnings ?? [],
          });
        } catch (reason) {
          setCardMessage({ level: 'error', text: reason instanceof Error ? reason.message : String(reason) });
        } finally {
          setCardBusy(false);
        }
      };
      const save = async () => {
        if (name.trim().length === 0) {
          setError(t('owner.nameRequired'));
          return;
        }
        setSaving(true);
        setError(null);
        setSaved(false);
        try {
          await store.saveOwner({
            name: name.trim(),
            avatar,
            oneLiner,
            setting,
            relations,
          });
          setSaved(true);
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : String(reason));
        } finally {
          setSaving(false);
        }
      };
      return h(
        'div',
        null,
        h('p', { className: 'mgc-hint', style: { margin: '0 0 14px' } }, t('owner.hint')),
        h(
          'div',
          { className: 'mgc-formActions', style: { justifyContent: 'flex-start', marginBottom: '8px' } },
          h(
            'button',
            { type: 'button', className: 'mgc-btn', onClick: exportCard, disabled: cardBusy },
            h(IconDownload, { size: 12 }),
            t('portable.characterExport'),
          ),
          h(
            'button',
            { type: 'button', className: 'mgc-btn', onClick: () => cardInput.current?.click(), disabled: cardBusy },
            cardBusy ? t('portable.reading') : t('portable.characterImport'),
          ),
        ),
        h('input', {
          ref: cardInput,
          type: 'file',
          accept: '.json,application/json',
          style: { display: 'none' },
          onChange: importCard,
        }),
        h('div', { className: 'mgc-hint', style: { marginBottom: '10px' } }, t('portable.characterHint')),
        cardMessage === null
          ? null
          : h(
              'div',
              { className: cardMessage.level === 'error' ? 'mgc-error' : 'mgc-success' },
              cardMessage.text,
              cardMessage.warnings?.length > 0
                ? h('div', { className: 'mgc-warnText' }, `${t('portable.warnings')} ${cardMessage.warnings.join(' ')}`)
                : null,
            ),
        h(
          'div',
          { className: 'mgc-field' },
          h('label', { className: 'mgc-label', htmlFor: `${uid.current}-name` }, t('owner.name')),
          h('input', {
            id: `${uid.current}-name`,
            className: 'mgc-input',
            value: name,
            maxLength: 16,
            onChange: (event) => setName(event.target.value),
            placeholder: t('owner.namePlaceholder'),
          }),
          h('div', { className: 'mgc-hint' }, t('owner.nameHint')),
        ),
        h(
          'div',
          { className: 'mgc-field' },
          h('label', { className: 'mgc-label', htmlFor: `${uid.current}-one` }, t('owner.oneLiner')),
          h('input', {
            id: `${uid.current}-one`,
            className: 'mgc-input',
            value: oneLiner,
            maxLength: 400,
            onChange: (event) => setOneLiner(event.target.value),
            placeholder: t('owner.oneLinerPlaceholder'),
          }),
        ),
        h(
          'div',
          { className: 'mgc-field' },
          h('label', { className: 'mgc-label', htmlFor: `${uid.current}-setting` }, t('owner.setting')),
          h('textarea', {
            id: `${uid.current}-setting`,
            className: 'mgc-textarea2 mgc-textareaCore',
            value: setting,
            onChange: (event) => setSetting(event.target.value),
            placeholder: t('owner.settingPlaceholder'),
          }),
          h(
            'div',
            { className: settingLength > 4000 ? 'mgc-warnText' : 'mgc-hint' },
            settingLength > 4000
              ? t('owner.overLimit', { n: settingLength - 4000 })
              : `${t('owner.settingHint')} · ${settingLength} / 4000`,
          ),
        ),
        h(
          'div',
          { className: 'mgc-formSection' },
          h('div', { className: 'mgc-label' }, t('common.optional')),
          h('div', { className: 'mgc-hint' }, t('owner.optionalHint')),
        ),
        h(AvatarField, {
          t,
          avatar,
          name: name || '用户',
          owner: true,
          onChange: setAvatar,
        }),
        members.length > 0
          ? h(
              'div',
              { className: 'mgc-field' },
              h('div', { className: 'mgc-label' }, t('owner.relations')),
              members.map((member) =>
                h(
                  'div',
                  { key: member.id, style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' } },
                  h('span', { className: 'mgc-hint', style: { width: '96px', flex: 'none' } }, t('members.relationWith', { name: member.name })),
                  h('input', {
                    className: 'mgc-input',
                    value: relations[member.id] ?? '',
                    maxLength: 200,
                    onChange: (event) => setRelations((current) => ({ ...current, [member.id]: event.target.value })),
                    placeholder: t('common.none'),
                  }),
                ),
              ),
            )
          : null,
        error !== null ? h('p', { className: 'mgc-error' }, error) : null,
        saved ? h('p', { className: 'mgc-success' }, t('common.saved')) : null,
        h(
          'div',
          { className: 'mgc-formActions' },
          h(
            'button',
            { type: 'button', className: 'mgc-btn mgc-btnPrimary', onClick: save, disabled: saving },
            saving ? t('common.saving') : t('owner.save'),
          ),
        ),
      );
    }

    /**
     * Pick characters from the global library that are not yet in this group.
     * @param {{state: object, t: object, store: object, onDone: Function, onCancel: Function}} props - picker inputs.
     * @returns {any} element.
     */
    function GroupCharacterPicker({ state, t, store, onDone, onCancel }) {
      const memberIds = new Set(state.members.map((member) => member.id));
      const available = state.characters.filter((character) => !memberIds.has(character.id));
      const [selected, setSelected] = useState([]);
      const [error, setError] = useState(null);
      const [busy, setBusy] = useState(false);
      const limit = Math.max(0, 3 - state.members.length);
      const toggle = (id) => {
        setSelected((current) => {
          if (current.includes(id)) return current.filter((value) => value !== id);
          if (current.length >= limit) return current;
          return [...current, id];
        });
      };
      const submit = async () => {
        if (selected.length === 0) return;
        setBusy(true);
        setError(null);
        try {
          await store.addGroupCharacters(selected);
          onDone();
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : String(reason));
        } finally {
          setBusy(false);
        }
      };
      return h(
        'div',
        null,
        h(
          'div',
          { className: 'mgc-sectionHead' },
          h('h3', { className: 'mgc-cardTitle' }, t('members.pullTitle')),
          h('button', { type: 'button', className: 'mgc-btn', onClick: onCancel }, t('common.cancel')),
        ),
        h('div', { className: 'mgc-hint', style: { marginBottom: '10px' } }, t('members.pullHint')),
        available.length === 0
          ? h('p', { className: 'mgc-hint' }, t('members.noAvailable'))
          : h(
              'div',
              { className: 'mgc-memberList' },
              available.map((character) =>
                h(
                  'label',
                  { key: character.id, className: 'mgc-memberRow', style: { cursor: 'pointer' } },
                  h('input', {
                    type: 'checkbox',
                    checked: selected.includes(character.id),
                    disabled: !selected.includes(character.id) && selected.length >= limit,
                    onChange: () => toggle(character.id),
                  }),
                  h(Avatar, { name: character.name, color: avatarColor(state.characters, character.id), small: true, src: character.avatar ?? null }),
                  h(
                    'span',
                    { className: 'mgc-memberText' },
                    h('span', { className: 'mgc-memberName' }, character.name),
                    h('span', { className: 'mgc-memberOneLiner' }, character.public?.oneLiner || t('common.none')),
                  ),
                ),
              ),
            ),
        error !== null ? h('p', { className: 'mgc-error' }, error) : null,
        h(
          'div',
          { className: 'mgc-formActions', style: { justifyContent: 'flex-start', marginTop: '12px' } },
          h('button', { type: 'button', className: 'mgc-btn mgc-btnPrimary', onClick: submit, disabled: busy || selected.length === 0 }, selected.length > 0 ? `${t('members.pull')} (${selected.length})` : t('members.pull')),
        ),
      );
    }

    /**
     * Global character library plus the shared character editor.
     * @param {{state: object, t: object, store: object}} props - library inputs.
     * @returns {any} element.
     */
    function CharacterLibrary({ state, t, store }) {
      const [editing, setEditing] = useState(null);
      const [draft, setDraft] = useState(null);
      const [error, setError] = useState(null);
      const [notice, setNotice] = useState(null);
      const [busy, setBusy] = useState(false);
      const fileInput = useRef(null);
      const selected = editing === 'new' ? null : state.characters.find((character) => character.id === editing) ?? null;
      const formMember = draft ?? selected;
      const started = editing === 'new' || selected !== null || draft !== null;
      const close = () => {
        setEditing(null);
        setDraft(null);
        setError(null);
        setNotice(null);
      };
      const openNew = () => {
        setDraft(null);
        setEditing('new');
        setError(null);
        setNotice(null);
      };
      const importCard = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file === undefined) return;
        if (file.size > PORTABLE_FILE_LIMIT) {
          setError(t('portable.tooLarge'));
          return;
        }
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
          const result = await store.previewCharacterImport(await file.text(), 'character');
          const fields = result.fields;
          setDraft({
            name: fields.name ?? '',
            avatar: fields.avatar ?? '',
            public: { oneLiner: fields.oneLiner ?? '', relations: { ...(fields.relations ?? {}) } },
            style: fields.style ?? '',
            memory: fields.memory ?? '',
            privateRelations: { ...(fields.privateRelations ?? {}) },
            core: fields.core ?? '',
            extended: fields.extended ?? '',
            extendedEnabled: fields.extendedEnabled === true,
            model: fields.model ?? null,
          });
          setEditing('new');
          setNotice({ text: t('library.imported'), warnings: result.warnings ?? [] });
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : String(reason));
        } finally {
          setBusy(false);
        }
      };
      const copy = async (character) => {
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
          const base = [...character.name].slice(0, 12).join('');
          await store.saveCharacter({
            name: `${base}·副本`,
            oneLiner: character.public?.oneLiner ?? '',
            relations: character.public?.relations ?? {},
            privateRelations: character.privateRelations ?? {},
            style: character.style ?? '',
            memory: character.memory ?? '',
            core: character.core ?? '',
            extended: character.extended ?? '',
            extendedEnabled: character.extendedEnabled === true,
            avatar: character.avatar ?? '',
            model: character.model ?? null,
          });
          setNotice({ text: t('library.saved'), warnings: [] });
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : String(reason));
        } finally {
          setBusy(false);
        }
      };
      if (started) {
        return h(
          'div',
          null,
          h(
            'div',
            { className: 'mgc-sectionHead' },
            h('h3', { className: 'mgc-cardTitle' }, formMember === null ? t('library.new') : draft !== null ? t('library.imported') : t('library.edit')),
            h('button', { type: 'button', className: 'mgc-btn', onClick: close }, t('common.cancel')),
          ),
          h(MemberForm, {
            key: draft !== null ? 'imported-character' : selected?.id ?? 'new-character',
            member: formMember,
            members: state.characters,
            state,
            t,
            store,
            mode: 'character',
            onDone: close,
          }),
        );
      }
      const remove = async (character) => {
        if (!window.confirm(t('library.deleteConfirm', { name: character.name }))) return;
        setError(null);
        setNotice(null);
        try {
          await store.deleteCharacter(character.id);
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      };
      return h(
        'div',
        null,
        h(
          'div',
          { className: 'mgc-sectionHead' },
          h('h3', { className: 'mgc-cardTitle' }, t('library.title')),
          h(
            'div',
            { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
            h('button', { type: 'button', className: 'mgc-btn', onClick: openNew }, t('library.new')),
            h('button', { type: 'button', className: 'mgc-btn', onClick: () => fileInput.current?.click(), disabled: busy }, t('library.import')),
          ),
        ),
        h('input', {
          ref: fileInput,
          type: 'file',
          accept: '.json,application/json',
          style: { display: 'none' },
          onChange: importCard,
        }),
        h('div', { className: 'mgc-hint', style: { marginBottom: '10px' } }, t('library.hint')),
        h('div', { className: 'mgc-hint', style: { marginBottom: '10px' } }, t('library.importHint')),
        state.characters.length === 0
          ? h('p', { className: 'mgc-hint' }, t('library.empty'))
          : h(
              'div',
              { className: 'mgc-memberList' },
              state.characters.map((character) =>
                h(
                  'div',
                  { key: character.id, className: 'mgc-memberRow', style: { cursor: 'default' } },
                  h(Avatar, { name: character.name, color: avatarColor(state.characters, character.id), small: true, src: character.avatar ?? null }),
                  h(
                    'span',
                    { className: 'mgc-memberText' },
                    h('span', { className: 'mgc-memberName' }, character.name),
                    h('span', { className: 'mgc-memberOneLiner' }, character.public?.oneLiner || t('common.none')),
                    h('span', { className: 'mgc-hint' }, character.usageGroups?.length > 0
                      ? `${t('library.usage', { n: character.usageGroups.length })} · ${character.usageGroups.map((group) => group.name).join('、')}`
                      : t('library.usage', { n: 0 })),
                  ),
                  h('button', { type: 'button', className: 'mgc-btn', onClick: () => setEditing(character.id) }, t('library.edit')),
                  h('button', { type: 'button', className: 'mgc-btn', onClick: () => copy(character), disabled: busy }, t('library.copy')),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'mgc-btn mgc-btnDanger',
                      disabled: (character.usageGroups?.length ?? 0) > 0,
                      title: (character.usageGroups?.length ?? 0) > 0 ? t('library.inUse') : t('library.delete'),
                      onClick: () => remove(character),
                    },
                    t('library.delete'),
                  ),
                ),
              ),
            ),
        notice !== null
          ? h(
              'div',
              { className: 'mgc-success' },
              notice.text,
              notice.warnings?.length > 0 ? h('div', { className: 'mgc-warnText' }, notice.warnings.join(' ')) : null,
            )
          : null,
        error !== null ? h('p', { className: 'mgc-error' }, error) : null,
      );
    }

    /**
     * Group roster plus the shared member editor and library picker.
     * @param {{state: object, t: object, store: object}} props - editor inputs.
     * @returns {any} element.
     */
    function MembersEditor({ state, t, store }) {
      const [editing, setEditing] = useState(null);
      const [pulling, setPulling] = useState(false);
      const [error, setError] = useState(null);
      const selected = editing === 'new' ? null : state.members.find((member) => member.id === editing) ?? null;
      const started = editing === 'new' || selected !== null;
      const remove = async () => {
        if (selected === null || state.members.length <= 2) return;
        setError(null);
        try {
          await store.removeGroupCharacter(selected.id);
          setEditing(null);
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      };
      if (pulling) {
        return h(GroupCharacterPicker, { state, t, store, onDone: () => setPulling(false), onCancel: () => setPulling(false) });
      }
      if (!started) {
        const memberIds = new Set(state.members.map((member) => member.id));
        const available = state.characters.some((character) => !memberIds.has(character.id));
        return h(
          'div',
          null,
          h(
            'div',
            { className: 'mgc-sectionHead' },
            h('h3', { className: 'mgc-cardTitle' }, t('members.title')),
            h(
              'div',
              { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
              h(
                'button',
                { type: 'button', className: 'mgc-btn', onClick: () => setPulling(true), disabled: state.members.length >= 3 || !available },
                t('members.pull'),
              ),
              h(
                'button',
                { type: 'button', className: 'mgc-btn', onClick: () => setEditing('new'), disabled: state.members.length >= 3 },
                t('members.add'),
              ),
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
                    h(Avatar, { name: member.name, color: avatarColor(state.members, member.id), small: true, src: member.avatar ?? null }),
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
          error !== null ? h('p', { className: 'mgc-error' }, error) : null,
          h('div', { className: 'mgc-hint', style: { marginTop: '12px' } }, t('members.libraryHint')),
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
          h(
            'div',
            { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
            selected !== null && state.members.length > 2
              ? h('button', { type: 'button', className: 'mgc-btn mgc-btnDanger', onClick: remove }, t('members.remove'))
              : null,
            h('button', { type: 'button', className: 'mgc-btn', onClick: () => setEditing(null) }, t('common.cancel')),
          ),
        ),
        selected !== null && state.members.length > 2
          ? h('div', { className: 'mgc-hint', style: { marginBottom: '10px' } }, t('members.removeHint'))
          : null,
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
     * Import control shared by the export card and the onboarding form.
     * @param {{store: object, t: object, disabled?: boolean, onImported?: Function}} props - control inputs.
     * @returns {any} element.
     */
    function GroupImportControl({ store, t, disabled = false, onImported }) {
      const [busy, setBusy] = useState(false);
      const [preview, setPreview] = useState(null);
      const [text, setText] = useState('');
      const [error, setError] = useState(null);
      const [notice, setNotice] = useState(null);
      const input = useRef(null);

      const choose = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file === undefined) return;
        if (file.size > PORTABLE_FILE_LIMIT) {
          setError(t('portable.tooLarge'));
          return;
        }
        setBusy(true);
        setError(null);
        setNotice(null);
        setPreview(null);
        try {
          const content = await file.text();
          const result = await store.previewGroupImport(content);
          setText(content);
          setPreview(result);
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : String(reason));
        } finally {
          setBusy(false);
        }
      };

      const importGroup = async () => {
        if (text.length === 0) return;
        setBusy(true);
        setError(null);
        setNotice(null);
        let imported = null;
        try {
          imported = await store.importGroupBundle(text);
          setPreview(null);
          setText('');
          setNotice(t('portable.imported', { name: imported.state.group.name }));
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : String(reason));
        } finally {
          setBusy(false);
        }
        if (imported !== null && onImported !== undefined) onImported(imported);
      };

      const summary = preview?.preview ?? null;
      const warnings = preview?.warnings ?? [];
      return h(
        'div',
        null,
        h(
          'div',
          { className: 'mgc-formActions', style: { justifyContent: 'flex-start', marginBottom: '8px' } },
          h(
            'button',
            { type: 'button', className: 'mgc-btn', onClick: () => input.current?.click(), disabled: busy || disabled },
            busy ? t('portable.reading') : t('portable.importGroup'),
          ),
        ),
        h('input', {
          ref: input,
          type: 'file',
          accept: '.json,application/json',
          style: { display: 'none' },
          onChange: choose,
        }),
        error !== null ? h('p', { className: 'mgc-error' }, error) : null,
        notice !== null ? h('p', { className: 'mgc-success' }, notice) : null,
        summary === null
          ? null
          : h(
              'div',
              { className: 'mgc-formSection' },
              h('div', { className: 'mgc-label' }, t('portable.previewTitle')),
              h('div', { className: 'mgc-cardTitle', style: { marginBottom: '6px' } }, summary.groupName),
              summary.brief.length > 0 ? h('p', { className: 'mgc-hint', style: { margin: '0 0 6px' } }, summary.brief) : null,
              summary.scene?.length > 0
                ? h('p', { className: 'mgc-hint', style: { margin: '0 0 6px' } }, t('portable.previewScene', { scene: summary.scene }))
                : null,
              h('div', { className: 'mgc-hint' }, t('portable.previewOwner', { name: summary.ownerName })),
              h('div', { className: 'mgc-hint' }, t('portable.previewMembers', { count: summary.memberCount })),
              h('div', { className: 'mgc-hint' }, summary.members.map((member) => member.name).join('、')),
              h(
                'div',
                { className: 'mgc-hint' },
                t('portable.previewPolicy', {
                  targets: summary.policy.maxMentionReplies,
                  chance: summary.policy.bystanderChance,
                }),
              ),
              h(
                'div',
                { className: 'mgc-hint' },
                `${t('portable.previewAvatars', { count: summary.avatarCount })} · ${t('portable.previewBytes', { size: fmtBytes(summary.bytes) })}`,
              ),
              warnings.length === 0
                ? h('div', { className: 'mgc-hint' }, t('portable.noWarnings'))
                : h(
                    'div',
                    { className: 'mgc-warnText' },
                    `${t('portable.warnings')} ${warnings.join(' ')}`,
                  ),
              h(
                'div',
                { className: 'mgc-formActions', style: { justifyContent: 'flex-start', marginTop: '10px' } },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'mgc-btn',
                    onClick: () => {
                      setPreview(null);
                      setText('');
                    },
                    disabled: busy,
                  },
                  t('common.cancel'),
                ),
                h(
                  'button',
                  { type: 'button', className: 'mgc-btn mgc-btnPrimary', onClick: importGroup, disabled: busy || disabled },
                  busy ? t('portable.importing') : t('portable.importAsNew'),
                ),
              ),
            ),
      );
    }

    /**
     * Group backup (portable JSON) export/import card.
     * @param {{state: object, t: object, store: object}} props - panel inputs.
     * @returns {any} element.
     */
    function PortableGroupPanel({ state, t, store }) {
      const [includeAvatars, setIncludeAvatars] = useState(true);
      const [includePrivate, setIncludePrivate] = useState(false);
      const [busy, setBusy] = useState(false);
      const [error, setError] = useState(null);
      const [notice, setNotice] = useState(null);
      const turnBusy = state.busy || state.activeTurn !== null;

      const exportGroup = async () => {
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
          const result = await store.exportPortable({ scope: 'group', includeAvatars, includePrivate });
          downloadText(result.filename, `${JSON.stringify(result.data, null, 2)}\n`);
          setNotice(t('portable.groupExported'));
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : String(reason));
        } finally {
          setBusy(false);
        }
      };

      return h(
        'div',
        { className: 'mgc-card', style: { marginBottom: '18px' } },
        h('h3', { className: 'mgc-cardTitle' }, t('portable.title')),
        h('p', { className: 'mgc-hint', style: { margin: '4px 0 12px' } }, t('portable.hint')),
        h(
          'label',
          { className: 'mgc-check', style: { marginBottom: '8px' } },
          h('input', {
            type: 'checkbox',
            checked: includeAvatars,
            onChange: (event) => setIncludeAvatars(event.target.checked),
          }),
          t('portable.includeAvatars'),
        ),
        h('div', { className: 'mgc-hint', style: { marginBottom: '12px' } }, t('portable.avatarNote')),
        h(
          'label',
          { className: 'mgc-check', style: { marginBottom: '8px' } },
          h('input', {
            type: 'checkbox',
            checked: includePrivate,
            onChange: (event) => setIncludePrivate(event.target.checked),
          }),
          t('portable.includePrivate'),
        ),
        h('div', { className: 'mgc-hint', style: { marginBottom: '12px' } }, t('portable.privateNote')),
        includePrivate ? h('div', { className: 'mgc-privateWarning' }, t('portable.privateWarning')) : null,
        h(
          'div',
          { className: 'mgc-formActions', style: { justifyContent: 'flex-start', marginBottom: '10px' } },
          h(
            'button',
            { type: 'button', className: 'mgc-btn mgc-btnPrimary', onClick: exportGroup, disabled: busy },
            h(IconDownload, { size: 12 }),
            busy ? t('portable.exporting') : t('portable.exportGroup'),
          ),
        ),
        h('div', { className: 'mgc-hint', style: { marginBottom: '10px' } }, t('portable.onlyJson')),
        turnBusy ? h('div', { className: 'mgc-warnText', style: { marginBottom: '10px' } }, t('portable.importBusy')) : null,
        error !== null ? h('p', { className: 'mgc-error' }, error) : null,
        notice !== null ? h('p', { className: 'mgc-success' }, notice) : null,
        h(GroupImportControl, { store, t, disabled: turnBusy }),
      );
    }

    /**
     * Markdown export panel plus the portable group backup card.
     * @param {{state: object, t: object, store: object}} props - export inputs.
     * @returns {any} element.
     */
    function ExportPanel({ state, t, store }) {
      const [includeHistory, setIncludeHistory] = useState(false);
      const [loading, setLoading] = useState(false);
      const [result, setResult] = useState(null);
      const [error, setError] = useState(null);
      const [copied, setCopied] = useState(false);
      useEffect(() => {
        setResult(null);
        setError(null);
        setCopied(false);
      }, [state.group?.id]);
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
        downloadText(
          `${(state.group?.name ?? 'group').replace(/[\\/:*?"<>|]/g, '_')}.md`,
          result.markdown,
          'text/markdown;charset=utf-8',
        );
      };
      return h(
        'div',
        null,
        h(PortableGroupPanel, { state, t, store }),
        h('div', { className: 'mgc-label', style: { margin: '4px 0 8px' } }, t('export.markdownTitle')),
        h('div', { className: 'mgc-privateWarning' }, t('export.privateNote')),
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
        ['owner', t('manage.tab.owner')],
        ['members', t('manage.tab.members')],
        ['characters', t('manage.tab.characters')],
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
          tab === 'owner' ? h(OwnerForm, { key: state.group.id, state, t, store }) : null,
          tab === 'members' ? h(MembersEditor, { state, t, store }) : null,
          tab === 'characters' ? h(CharacterLibrary, { state, t, store }) : null,
          tab === 'export' ? h(ExportPanel, { state, t, store }) : null,
        ),
      );
    }

    /**
     * Creation form used by the empty state and the settings section.
     * @param {object} props - creation inputs.
     * @returns {any} element.
     */
    function CreateGroupForm({ store, state, t, embedded, allowCancel, onCancel, onCreated }) {
      const [name, setName] = useState('');
      const [brief, setBrief] = useState('');
      const [ownerName, setOwnerName] = useState('');
      const [ownerOneLiner, setOwnerOneLiner] = useState('');
      const [ownerSetting, setOwnerSetting] = useState('');
      const [drafts, setDrafts] = useState(() => [
        { key: 'a', name: '', oneLiner: '', core: '' },
        { key: 'b', name: '', oneLiner: '', core: '' },
      ]);
      const [mode, setMode] = useState(state.characters.length >= 2 ? 'library' : 'new');
      const [selectedIds, setSelectedIds] = useState([]);
      const [error, setError] = useState(null);
      const toggleCharacter = (id) => setSelectedIds((current) => {
        if (current.includes(id)) return current.filter((value) => value !== id);
        if (current.length >= 3) return current;
        return [...current, id];
      });
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
        if (mode === 'library' && (selectedIds.length < 2 || selectedIds.length > 3)) {
          setError(t('create.selectAtLeastTwo'));
          return;
        }
        if (mode === 'new' && drafts.some((draft) => draft.name.trim().length === 0)) {
          setError(t('errors.members'));
          return;
        }
        setSaving(true);
        setError(null);
        try {
          await store.createGroup({
            name: name.trim(),
            brief,
            owner: {
              name: ownerName.trim() || '用户',
              oneLiner: ownerOneLiner,
              setting: ownerSetting,
            },
            ...(mode === 'library'
              ? { characterIds: selectedIds }
              : {
                  members: drafts.map((draft) => ({
                    name: draft.name.trim(),
                    oneLiner: draft.oneLiner,
                    core: draft.core,
                  })),
                }),
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
        h('div', { className: 'mgc-hint', style: { marginBottom: '16px' } }, t('create.fieldsHint')),
        h(
          'div',
          { className: 'mgc-card', style: { marginBottom: '16px' } },
          h('h3', { className: 'mgc-cardTitle' }, t('portable.importGroup')),
          h('p', { className: 'mgc-hint', style: { margin: '4px 0 10px' } }, t('portable.importOnlyHint')),
          h(GroupImportControl, { store, t, onImported: onCreated }),
        ),
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
        h(
          'div',
          { className: 'mgc-card' },
          h(
            'div',
            { className: 'mgc-draftHead' },
            h('span', { className: 'mgc-draftTitle' }, t('owner.title')),
            h('span', { className: 'mgc-hint' }, t('owner.optional')),
          ),
          h(
            'div',
            { className: 'mgc-row2' },
            h(
              'div',
              { className: 'mgc-field' },
              h('label', { className: 'mgc-label', htmlFor: 'mgc-create-owner-name' }, t('owner.name')),
              h('input', {
                id: 'mgc-create-owner-name',
                className: 'mgc-input',
                value: ownerName,
                maxLength: 16,
                onChange: (event) => setOwnerName(event.target.value),
                placeholder: t('owner.namePlaceholder'),
              }),
            ),
            h(
              'div',
              { className: 'mgc-field' },
              h('label', { className: 'mgc-label', htmlFor: 'mgc-create-owner-one' }, t('owner.oneLiner')),
              h('input', {
                id: 'mgc-create-owner-one',
                className: 'mgc-input',
                value: ownerOneLiner,
                maxLength: 400,
                onChange: (event) => setOwnerOneLiner(event.target.value),
                placeholder: t('owner.oneLinerPlaceholder'),
              }),
            ),
          ),
          h(
            'div',
            { className: 'mgc-field', style: { marginBottom: 0 } },
            h('label', { className: 'mgc-label', htmlFor: 'mgc-create-owner-setting' }, t('owner.setting')),
            h('textarea', {
              id: 'mgc-create-owner-setting',
              className: 'mgc-textarea2',
              value: ownerSetting,
              onChange: (event) => setOwnerSetting(event.target.value),
              placeholder: t('owner.settingPlaceholder'),
            }),
            h('div', { className: 'mgc-hint' }, t('owner.settingHint')),
          ),
        ),
        h('div', { className: 'mgc-label', style: { margin: '6px 0 8px' } }, t('create.members')),
        h(
          'div',
          { className: 'mgc-formActions', style: { justifyContent: 'flex-start', marginBottom: '10px' } },
          h(
            'button',
            {
              type: 'button',
              className: mode === 'library' ? 'mgc-btn mgc-btnPrimary' : 'mgc-btn',
              onClick: () => setMode('library'),
              disabled: state.characters.length < 2,
            },
            t('create.fromLibrary'),
          ),
          h(
            'button',
            {
              type: 'button',
              className: mode === 'new' ? 'mgc-btn mgc-btnPrimary' : 'mgc-btn',
              onClick: () => setMode('new'),
            },
            t('create.newCharacters'),
          ),
        ),
        mode === 'library'
          ? h(
              'div',
              null,
              h('div', { className: 'mgc-hint', style: { marginBottom: '10px' } }, state.characters.length === 0 ? t('create.noLibrary') : t('create.selectHint')),
              state.characters.length === 0
                ? null
                : h(
                    'div',
                    { className: 'mgc-memberList' },
                    state.characters.map((character) =>
                      h(
                        'label',
                        { key: character.id, className: 'mgc-memberRow', style: { cursor: 'pointer' } },
                        h('input', {
                          type: 'checkbox',
                          checked: selectedIds.includes(character.id),
                          disabled: !selectedIds.includes(character.id) && selectedIds.length >= 3,
                          onChange: () => toggleCharacter(character.id),
                        }),
                        h(Avatar, { name: character.name, color: avatarColor(state.characters, character.id), small: true, src: character.avatar ?? null }),
                        h(
                          'span',
                          { className: 'mgc-memberText' },
                          h('span', { className: 'mgc-memberName' }, character.name),
                          h('span', { className: 'mgc-memberOneLiner' }, character.public?.oneLiner || t('common.none')),
                        ),
                      ),
                    ),
                  ),
              h('div', { className: 'mgc-hint', style: { marginTop: '8px' } }, t('create.selected', { n: selectedIds.length })),
            )
          : h(
              'div',
              null,
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
            ),
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
                  state,
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
                  h(
                    'div',
                    { className: 'mgc-sectionHead' },
                    h('h2', { className: 'mgc-sectionTitle' }, `${t('manage.tab.owner')} · ${state.owner?.name ?? t('messages.owner')}`),
                  ),
                  h(OwnerForm, { key: state.group.id, state, t, store }),
                ),
                h(
                  'div',
                  { className: 'mgc-section' },
                  h(MembersEditor, { state, t, store }),
                ),
              ),
          h(
            'div',
            { className: 'mgc-section' },
            h(CharacterLibrary, { state, t, store }),
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
        tag.dataset.plugin = '@zhdzh-good/multi-role-groupchat';
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

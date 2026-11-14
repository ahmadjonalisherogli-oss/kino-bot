import React, { useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Copy, FileCode2, Folder, Server } from 'lucide-react';
import type { CodebaseTreeNode } from '../types';

export const CodebaseDeploymentView: React.FC = () => {
  const [tree, setTree] = useState<CodebaseTreeNode[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    bot: true,
    backend: true,
    shared: true,
    tests: true,
  });
  const [selectedPath, setSelectedPath] = useState<string>('README.md');
  const [fileContent, setFileContent] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/codebase/tree')
      .then((r) => r.json())
      .then(setTree);
  }, []);

  useEffect(() => {
    if (!selectedPath) return;
    fetch(`/api/codebase/file?path=${encodeURIComponent(selectedPath)}`)
      .then((r) => r.json())
      .then((d) => setFileContent(d.content || ''));
  }, [selectedPath]);

  const copyCode = () => {
    navigator.clipboard.writeText(fileContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const renderNode = (node: CodebaseTreeNode, depth = 0) => {
    if (node.type === 'directory') {
      const isOpen = !!expanded[node.path];
      return (
        <div key={node.path}>
          <button
            onClick={() => setExpanded((prev) => ({ ...prev, [node.path]: !prev[node.path] }))}
            className="w-full flex items-center gap-1.5 py-1.5 px-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded text-left"
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
          >
            {isOpen ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
            <Folder className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{node.name}</span>
          </button>
          {isOpen && node.children?.map((child) => renderNode(child, depth + 1))}
        </div>
      );
    }

    const active = selectedPath === node.path;
    return (
      <button
        key={node.path}
        onClick={() => setSelectedPath(node.path)}
        className={`w-full flex items-center gap-1.5 py-1.5 px-2 text-xs rounded text-left transition-colors ${
          active ? 'bg-slate-900 text-white font-medium' : 'text-slate-600 hover:bg-slate-100'
        }`}
        style={{ paddingLeft: `${depth * 12 + 24}px` }}
      >
        <FileCode2 className="w-3.5 h-3.5 shrink-0 opacity-75" />
        <span className="truncate">{node.name}</span>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {/* Architecture & Setup Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-semibold text-slate-900 mb-1">1. Telegram Bot & Kanal Sozlash</div>
          <p className="text-xs text-slate-600 leading-relaxed">
            @BotFather orqali token oling, botni kanalingizga administrator qilib qo‘shing (Post/Edit huquqlari bilan) va kanal ID sini (<code>-100...</code>) ulang.
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-semibold text-slate-900 mb-1">2. Avtomatik Sinxronizatsiya</div>
          <p className="text-xs text-slate-600 leading-relaxed">
            <code>channel_post</code> va <code>edited_channel_post</code> video va MKV hujjatlardan <code>file_id</code> ni ajratib PostgreSQL ga saqlaydi.
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-semibold text-slate-900 mb-1">3. Ubuntu VPS & Docker</div>
          <p className="text-xs text-slate-600 leading-relaxed">
            <code>docker compose up -d --build</code> yoki systemd (Gunicorn + Aiogram + Celery + Nginx + Certbot SSL) bilan ishga tushiring.
          </p>
        </div>
      </div>

      {/* File Tree + Code Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-slate-200 p-3 max-h-[640px] overflow-y-auto bg-slate-50/50">
          <div className="flex items-center gap-2 px-2 pb-2 mb-2 border-b border-slate-200 text-xs font-semibold text-slate-800">
            <Server className="w-3.5 h-3.5" />
            telegram_movie_platform/
          </div>
          {tree.map((node) => renderNode(node))}
        </div>

        <div className="lg:col-span-8 flex flex-col max-h-[640px]">
          <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <span className="font-mono text-xs font-medium text-slate-800 truncate">{selectedPath}</span>
            <button
              onClick={copyCode}
              className="px-2.5 py-1 text-xs font-medium border border-slate-200 bg-white rounded hover:bg-slate-50 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Nusxalandi' : 'Nusxalash'}
            </button>
          </div>
          <pre className="p-4 text-xs font-mono text-slate-800 overflow-auto flex-1 leading-relaxed bg-white">
            <code>{fileContent}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};

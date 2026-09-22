"use client";

import React, { useState, useRef, useEffect } from "react";
import Papa from "papaparse";

interface StringItem {
  id: string;
  key: string;
  sourceText: string;
  targetText: string;
  maxChars?: number;
}

interface ValidationResult {
  hasError: boolean;
  missingTokens: string[];
  isOverLimit: boolean;
}

export default function LocalizationWorkspace() {
  const initialDemo: StringItem[] = [
    {
      id: "1",
      key: "ui_welcome_message",
      sourceText: "Welcome back, {playerName}! You have {0} coins.",
      targetText: "Willkommen zurück! Du hast {0} Münzen.",
      maxChars: 50,
    },
    {
      id: "2",
      key: "btn_start_game",
      sourceText: "PLAY NOW",
      targetText: "JETZT SOFORT SPIELEN STARTEN",
      maxChars: 15,
    },
    {
      id: "3",
      key: "dialog_reward",
      sourceText: "Found <color=#FF0000>%s</color> item!",
      targetText: "Gegenstand <color=#FF0000>%s</color> gefunden!",
      maxChars: 40,
    },
  ];

  const [items, setItems] = useState<StringItem[]>(initialDemo);
  const [filterErrorOnly, setFilterErrorOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [activeFileName, setActiveFileName] = useState<string>("demo_strings.csv");
  const [isMounted, setIsMounted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsMounted(true);
    const savedData = localStorage.getItem("l10n_saved_items");
    const savedName = localStorage.getItem("l10n_saved_filename");
    if (savedData) {
      try {
        setItems(JSON.parse(savedData));
      } catch (err) {
        console.error("Failed to parse local storage strings:", err);
      }
    }
    if (savedName) setActiveFileName(savedName);
  }, []);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem("l10n_saved_items", JSON.stringify(items));
      localStorage.setItem("l10n_saved_filename", activeFileName);
    }
  }, [items, activeFileName, isMounted]);

  const extractTokens = (text: string): string[] => {
    const bracketRegex = /\{[a-zA-Z0-9_]+\}/g;
    const printfRegex = /%[sdif]/g;
    return Array.from(new Set([...(text.match(bracketRegex) || []), ...(text.match(printfRegex) || [])]));
  };

  const validateString = (item: StringItem): ValidationResult => {
    const sourceTokens = extractTokens(item.sourceText || "");
    const target = item.targetText || "";
    const missingTokens = sourceTokens.filter((token) => !target.includes(token));
    const isOverLimit = item.maxChars ? target.length > item.maxChars : false;
    return {
      hasError: missingTokens.length > 0 || isOverLimit,
      missingTokens,
      isOverLimit,
    };
  };

  const handleTargetChange = (id: string, newText: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, targetText: newText } : item))
    );
  };

  const processCSV = (file: File) => {
    setActiveFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as Record<string, string>[];
        if (!rows || rows.length === 0) return;

        const headers = Object.keys(rows[0]);
        const keyCol = headers.find((h) => /^(key|id|string_id|name)$/i.test(h)) || headers[0];
        const sourceCol = headers.find((h) => /^(en|english|source|text)$/i.test(h)) || headers[1];
        const targetCol =
          headers.find((h) => h !== keyCol && h !== sourceCol && !/limit|char/i.test(h)) ||
          headers[2] ||
          sourceCol;
        const limitCol = headers.find((h) => /limit|max|char/i.test(h));

        const parsedItems: StringItem[] = rows.map((row, idx) => ({
          id: String(idx + 1),
          key: row[keyCol] || `string_${idx + 1}`,
          sourceText: row[sourceCol] || "",
          targetText: row[targetCol] || "",
          maxChars: limitCol && row[limitCol] ? parseInt(row[limitCol], 10) : undefined,
        }));

        setItems(parsedItems);
      },
      error: (error) => alert("Failed to parse CSV: " + error.message),
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith(".csv")) processCSV(file);
      else alert("Please upload a .csv file");
    }
  };

  const handleDownloadSampleCSV = () => {
    const sampleContent = `Key,Source,Target,MaxChars
quest_accept,"Accept the quest from {npcName}?","Nimm die Quest von an?",35
inv_full,"Inventory full! Cannot hold %d items.","Inventar voll! Kann Gegenstände nicht halten.",40
hud_hp,"HP: {0}/{1}","HP: {0}/{1}",15
btn_exit,"QUIT GAME","SPIEL JETZT SOFORT BEENDEN",12
dialog_shop,"Buy {itemCount} potions for {price} gold?","Kaufe Tränke für Gold?",45`;

    const blob = new Blob([sampleContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "sample_game_strings.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    localStorage.removeItem("l10n_saved_items");
    localStorage.removeItem("l10n_saved_filename");
    setItems(initialDemo);
    setActiveFileName("demo_strings.csv");
  };

  const handleExportCSV = () => {
    const csvData = items.map((item) => ({
      Key: item.key,
      Source: item.sourceText,
      Target: item.targetText,
      ...(item.maxChars ? { MaxChars: item.maxChars } : {}),
    }));

    const csvString = Papa.unparse(csvData);
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `cleaned_${activeFileName}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const totalErrors = items.filter((i) => validateString(i).hasError).length;

  const displayItems = items
    .filter((item) => (filterErrorOnly ? validateString(item).hasError : true))
    .filter((item) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.key.toLowerCase().includes(q) ||
        item.sourceText.toLowerCase().includes(q) ||
        item.targetText.toLowerCase().includes(q)
      );
    });

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="min-h-screen bg-[#0b0c10] text-[#c9cbd1] font-sans text-xs antialiased selection:bg-neutral-700 selection:text-white relative"
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => e.target.files?.[0] && processCSV(e.target.files[0])}
        accept=".csv"
        className="hidden"
      />

      {/* Global Drag Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-[#0b0c10]/90 backdrop-blur-sm border-2 border-dashed border-neutral-500 flex flex-col items-center justify-center pointer-events-none">
          <svg className="w-12 h-12 text-neutral-400 mb-3 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <div className="text-sm font-medium text-neutral-200">Drop CSV file to load workspace</div>
          <div className="text-xs text-neutral-500 mt-1">Client-side only • No file leaves your device</div>
        </div>
      )}

      {/* Top Application Bar */}
      <header className="border-b border-[#1b1d24] bg-[#0f1015]/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-[1400px] mx-auto px-4 h-12 flex items-center justify-between gap-4">
          
          {/* Brand & Security Badge */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-neutral-400"></span>
              <span className="font-semibold text-white tracking-tight text-[13px] font-mono">
                StringGuard
              </span>
            </div>
            <span className="h-3.5 w-px bg-neutral-800"></span>
            <span className="text-[11px] text-neutral-500 hidden sm:inline-flex items-center gap-1.5 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 inline-block"></span>
              Client Memory Only
            </span>
          </div>

          {/* Actions Bar */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="h-7 px-2.5 rounded border border-[#252833] bg-[#14161f] hover:bg-[#1b1e2a] hover:border-neutral-700 text-neutral-300 font-medium transition flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span>Import CSV</span>
            </button>

            <button
              onClick={handleDownloadSampleCSV}
              className="h-7 px-2.5 rounded border border-[#252833] bg-[#14161f] hover:bg-[#1b1e2a] hover:border-neutral-700 text-neutral-300 transition hidden md:inline-flex items-center gap-1.5"
              title="Download sample localization file for testing"
            >
              <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Sample CSV</span>
            </button>

            <button
              onClick={handleReset}
              className="h-7 px-2.5 rounded border border-[#252833] bg-[#14161f] hover:bg-[#1b1e2a] hover:border-neutral-700 text-neutral-400 hover:text-neutral-200 transition"
              title="Reset workspace to default demo"
            >
              Reset
            </button>

            <button
              onClick={handleExportCSV}
              className="h-7 px-3 rounded bg-neutral-100 hover:bg-white text-black font-semibold transition flex items-center gap-1.5 shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-[1400px] mx-auto px-4 py-4 space-y-3">
        
        {/* Workspace Toolbar (Unified Search, Filtering, & Metadata) */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#111218] border border-[#1e2029] p-2 rounded-md">
          
          {/* Left: Quick Search & Filter Chips */}
          <div className="flex items-center gap-2 flex-1 min-w-[280px]">
            <div className="relative flex-1 max-w-xs">
              <svg className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Filter keys or string content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-7 pl-8 pr-2.5 bg-[#0b0c10] border border-[#232631] rounded text-[11px] text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-500"
              />
            </div>

            <div className="flex items-center bg-[#0b0c10] border border-[#232631] rounded p-0.5">
              <button
                onClick={() => setFilterErrorOnly(false)}
                className={`h-6 px-2.5 rounded text-[11px] font-medium transition ${
                  !filterErrorOnly ? "bg-[#1f222e] text-white" : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                All ({items.length})
              </button>
              <button
                onClick={() => setFilterErrorOnly(true)}
                className={`h-6 px-2.5 rounded text-[11px] font-medium transition flex items-center gap-1.5 ${
                  filterErrorOnly ? "bg-[#1f222e] text-white" : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${totalErrors > 0 ? "bg-amber-400" : "bg-neutral-600"}`}></span>
                Issues ({totalErrors})
              </button>
            </div>
          </div>

          {/* Right: File Indicator */}
          <div className="flex items-center gap-2 text-[11px] text-neutral-500 font-mono">
            <span>Buffer:</span>
            <span className="text-neutral-300 bg-[#161822] px-2 py-0.5 rounded border border-[#222533]">
              {activeFileName}
            </span>
          </div>
        </div>

        {/* Data Grid / Editor Table */}
        <div className="border border-[#1e2029] rounded-md overflow-hidden bg-[#0e0f14]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#12141c] text-neutral-400 font-mono text-[11px] uppercase tracking-wider border-b border-[#1e2029]">
                <tr>
                  <th className="py-2 px-3 w-10 text-center font-normal">#</th>
                  <th className="py-2 px-3 w-48 font-normal">Key identifier</th>
                  <th className="py-2 px-3 w-[38%] font-normal">Source (Reference)</th>
                  <th className="py-2 px-3 font-normal">Target Translation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#171922] font-mono text-[11px]">
                {displayItems.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-neutral-500 font-sans">
                      No strings match the current criteria.
                    </td>
                  </tr>
                ) : (
                  displayItems.map((item, idx) => {
                    const check = validateString(item);
                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-[#13151f] transition-colors ${
                          check.hasError ? "bg-[#181114]/40" : ""
                        }`}
                      >
                        {/* Index */}
                        <td className="py-2.5 px-3 text-center text-neutral-600 select-none">
                          {idx + 1}
                        </td>

                        {/* Key Identifier & Limits */}
                        <td className="py-2.5 px-3 text-neutral-300 align-top">
                          <div className="font-semibold text-neutral-200 select-all">{item.key}</div>
                          {item.maxChars && (
                            <div className="text-[10px] text-neutral-500 mt-0.5 font-sans">
                              Max {item.maxChars} chars
                            </div>
                          )}
                        </td>

                        {/* Source Text */}
                        <td className="py-2.5 px-3 text-neutral-400 font-sans text-xs leading-relaxed align-top select-text">
                          {item.sourceText}
                        </td>

                        {/* Target Input with Inline Issue Chips */}
                        <td className="py-2.5 px-3 align-top space-y-1.5">
                          <input
                            type="text"
                            value={item.targetText}
                            onChange={(e) => handleTargetChange(item.id, e.target.value)}
                            className={`w-full bg-[#0a0b0f] px-2.5 py-1.5 rounded border text-xs font-sans text-neutral-200 focus:outline-none transition-colors ${
                              check.hasError
                                ? "border-red-900/60 focus:border-red-600 bg-red-950/10"
                                : "border-[#20232e] focus:border-neutral-500"
                            }`}
                          />

                          {/* Error diagnostics */}
                          {check.hasError && (
                            <div className="flex flex-wrap gap-1.5 font-sans text-[10px]">
                              {check.missingTokens.map((token) => (
                                <span
                                  key={token}
                                  className="bg-red-950/50 text-red-400 border border-red-900/60 px-1.5 py-0.5 rounded font-mono"
                                >
                                  Missing token: <strong>{token}</strong>
                                </span>
                              ))}

                              {check.isOverLimit && (
                                <span className="bg-amber-950/50 text-amber-400 border border-amber-900/60 px-1.5 py-0.5 rounded">
                                  Overflow ({item.targetText.length}/{item.maxChars})
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom Grid Status Bar */}
          <div className="bg-[#101117] border-t border-[#1a1c26] px-3 py-1.5 text-[11px] text-neutral-500 flex items-center justify-between font-mono">
            <div className="flex items-center gap-3">
              <span>{displayItems.length} rows loaded</span>
              <span>•</span>
              <span className={totalErrors > 0 ? "text-amber-500" : "text-emerald-500"}>
                {totalErrors} validation issues
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span>Encoding: UTF-8</span>
              <span>•</span>
              <span>Ready for Game Engine</span>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
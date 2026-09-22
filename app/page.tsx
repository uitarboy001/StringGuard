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
  const [isDragging, setIsDragging] = useState(false);
  const [activeFileName, setActiveFileName] = useState<string>("demo_strings.csv");
  const [isMounted, setIsMounted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. โหลดข้อมูลเดิมจาก LocalStorage เมื่อเปิดเว็บขึ้นมาครั้งแรก
  useEffect(() => {
    setIsMounted(true);
    const savedData = localStorage.getItem("l10n_saved_items");
    const savedName = localStorage.getItem("l10n_saved_filename");
    if (savedData) {
      try {
        setItems(JSON.parse(savedData));
      } catch (err) {
        console.error("Failed to parse saved strings:", err);
      }
    }
    if (savedName) {
      setActiveFileName(savedName);
    }
  }, []);

  // 2. เซฟข้อมูลลง LocalStorage อัตโนมัติทุกครั้งที่มีการพิมพ์หรือแก้ไฟล์
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem("l10n_saved_items", JSON.stringify(items));
      localStorage.setItem("l10n_saved_filename", activeFileName);
    }
  }, [items, activeFileName, isMounted]);

  const extractTokens = (text: string): string[] => {
    const bracketRegex = /\{[a-zA-Z0-9_]+\}/g;
    const printfRegex = /%[sdif]/g;
    const matches = [...(text.match(bracketRegex) || []), ...(text.match(printfRegex) || [])];
    return Array.from(new Set(matches));
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
      error: (error) => {
        alert("Failed to parse CSV: " + error.message);
      },
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith(".csv")) {
        processCSV(file);
      } else {
        alert("Please upload a valid .csv file");
      }
    }
  };

  const handleDownloadSampleCSV = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

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

  const displayItems = filterErrorOnly
    ? items.filter((item) => validateString(item).hasError)
    : items;

  const totalErrors = items.filter((i) => validateString(i).hasError).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Top Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">⚡</span>
              <h1 className="text-xl font-bold tracking-tight text-white">
                StringGuard
              </h1>
              <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/30 font-medium">
                100% In-Browser • Zero Leak
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Catch broken engine tokens, syntax bugs, and UI overflow before your game crashes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[11px] text-slate-500 flex items-center gap-1 font-mono mr-1">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full inline-block"></span>
              Auto-saved
            </span>
            <button
              onClick={() => handleDownloadSampleCSV()}
              className="text-xs bg-slate-900 hover:bg-slate-800 text-slate-300 px-3 py-2 rounded-lg border border-slate-700 transition flex items-center gap-1.5"
            >
              <span>📥</span>
              <span>Sample CSV</span>
            </button>
            <button
              onClick={handleReset}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-lg border border-slate-700 transition"
            >
              Reset Demo
            </button>
            <button
              onClick={handleExportCSV}
              className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-lg shadow-lg shadow-blue-600/20 transition flex items-center gap-1.5"
            >
              <span>Export Clean CSV</span>
              <span>↓</span>
            </button>
          </div>
        </header>

        {/* Drag & Drop Upload Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all duration-200 ${
            isDragging
              ? "border-blue-500 bg-blue-500/10 scale-[0.99]"
              : "border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900"
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files?.[0] && processCSV(e.target.files[0])}
            accept=".csv"
            className="hidden"
          />
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-lg text-blue-400">
              📁
            </div>
            <div className="text-sm font-semibold text-slate-200">
              Drag & Drop your localization <code className="text-blue-400">.csv</code> file here, or <span className="text-blue-400 underline">browse</span>
            </div>
            <p className="text-xs text-slate-500">
              Current loaded file: <span className="text-slate-300 font-mono">{activeFileName}</span> (Processed entirely on your device)
            </p>
            
            <div className="pt-2">
              <button
                type="button"
                onClick={handleDownloadSampleCSV}
                className="text-xs text-blue-400 hover:text-blue-300 underline font-medium inline-flex items-center gap-1"
              >
                <span>Don't have a file? Download sample CSV to test</span>
                <span>↗</span>
              </button>
            </div>
          </div>
        </div>

        {/* Status Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Total Strings</div>
            <div className="text-2xl font-bold text-white mt-1">{items.length}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Crash & Overflow Risks</div>
            <div className={`text-2xl font-bold mt-1 ${totalErrors > 0 ? "text-rose-400" : "text-emerald-400"}`}>
              {totalErrors} {totalErrors === 1 ? "Issue" : "Issues"}
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">View Filter</div>
              <div className="text-sm font-medium text-slate-200 mt-1">
                {filterErrorOnly ? "Issues Only" : "All Strings"}
              </div>
            </div>
            <button
              onClick={() => setFilterErrorOnly(!filterErrorOnly)}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition ${
                filterErrorOnly
                  ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                  : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
              }`}
            >
              {filterErrorOnly ? "Show All" : "Show Issues Only"}
            </button>
          </div>
        </div>

        {/* Translation Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-800/80 text-slate-400 uppercase font-mono tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3.5 w-16 text-center">Status</th>
                  <th className="p-3.5 w-48">Key</th>
                  <th className="p-3.5 w-1/3">Source (EN)</th>
                  <th className="p-3.5">Target Translation (Live Editable)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {displayItems.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500 font-sans">
                      No strings match the selected filter.
                    </td>
                  </tr>
                ) : (
                  displayItems.map((item) => {
                    const check = validateString(item);
                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-slate-800/30 transition ${
                          check.hasError ? "bg-rose-950/10" : ""
                        }`}
                      >
                        <td className="p-3.5 text-center">
                          {check.hasError ? (
                            <span className="inline-block w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse" title="Issue detected" />
                          ) : (
                            <span className="inline-block w-2.5 h-2.5 bg-emerald-500 rounded-full" title="Valid" />
                          )}
                        </td>

                        <td className="p-3.5 font-semibold text-slate-300">
                          {item.key}
                          {item.maxChars && (
                            <div className="text-[10px] text-slate-500 font-sans mt-0.5">
                              Limit: {item.maxChars} chars
                            </div>
                          )}
                        </td>

                        <td className="p-3.5 text-slate-300 leading-relaxed font-sans">
                          {item.sourceText}
                        </td>

                        <td className="p-3.5 space-y-2">
                          <input
                            type="text"
                            value={item.targetText}
                            onChange={(e) => handleTargetChange(item.id, e.target.value)}
                            className={`w-full bg-slate-950 px-3 py-2 rounded-lg border font-sans text-sm focus:outline-none transition ${
                              check.hasError
                                ? "border-rose-500/80 focus:border-rose-400 text-rose-200"
                                : "border-slate-700 focus:border-blue-500 text-slate-200"
                            }`}
                          />

                          <div className="flex flex-wrap gap-2 text-[11px] font-sans">
                            {check.missingTokens.map((token) => (
                              <span
                                key={token}
                                className="bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded border border-rose-500/30 flex items-center gap-1"
                              >
                                ⚠️ Missing token: <strong className="font-mono">{token}</strong>
                              </span>
                            ))}

                            {check.isOverLimit && (
                              <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
                                ⚠️ Length overflow ({item.targetText.length}/{item.maxChars})
                              </span>
                            )}

                            {!check.hasError && (
                              <span className="text-emerald-400 text-[10px]">
                                ✓ Clean & safe
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Sparkles, RefreshCw, AlertTriangle } from 'lucide-react';
import { MarketTicker } from '../types';

interface AIAnalysisProps {
  ticker: MarketTicker;
  marketTrend: number[];
}

const AIAnalysis: React.FC<AIAnalysisProps> = ({ ticker, marketTrend }) => {
  const [analysis, setAnalysis] = useState<string>("Click 'Analyze' to get AI-powered market insights.");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!process.env.API_KEY) {
      setError("API Key not configured in environment.");
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysis("Analyzing market structure...");

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const prompt = `
        You are a senior commodities trader AI. Analyze the following data for ${ticker.symbol}.
        Current Price: ${ticker.price}
        Change: ${ticker.changePercent}%
        Volume: ${ticker.volume}
        Recent Price Trend (last 10 ticks): ${marketTrend.slice(-10).join(', ')}
        
        Provide a concise technical analysis (max 3 sentences) focusing on momentum and potential resistance levels. 
        Adopt a professional financial tone.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      setAnalysis(response.text || "No analysis available.");
    } catch (err) {
      console.error(err);
      setError("Failed to generate analysis. Service may be unavailable.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col gap-3 h-full">
      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
        <h3 className="font-semibold text-indigo-400 flex items-center gap-2">
          <Sparkles size={16} /> Gemini Market AI
        </h3>
        <button 
          onClick={handleAnalyze} 
          disabled={loading}
          className="p-1.5 bg-indigo-600/20 text-indigo-400 rounded hover:bg-indigo-600/40 disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="flex-1 overflow-auto text-sm text-slate-300 leading-relaxed">
        {error ? (
          <div className="text-rose-400 flex items-center gap-2 bg-rose-900/20 p-2 rounded border border-rose-900/50">
            <AlertTriangle size={16} />
            {error}
          </div>
        ) : (
          <p className={loading ? "animate-pulse" : ""}>{analysis}</p>
        )}
      </div>
      
      <div className="text-xs text-slate-600 mt-2 border-t border-slate-800 pt-2">
        Powered by Google Gemini • Not financial advice
      </div>
    </div>
  );
};

export default AIAnalysis;
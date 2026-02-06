
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Marker, AnalysisConfig, ExportFormat } from './types';
import { analyzeBeats, formatTime } from './services/audioEngine';
import { exportMarkers } from './services/exportService';

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [config, setConfig] = useState<AnalysisConfig>({
    sensitivity: 0.7,
    minDistance: 0.25,
    aggressiveMode: false
  });
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseOffsetRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);

  // Initialize Audio Context
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    return () => {
      audioContextRef.current?.close();
    };
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile || !audioContextRef.current) return;

    setFile(selectedFile);
    const arrayBuffer = await selectedFile.arrayBuffer();
    const decodedBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
    setAudioBuffer(decodedBuffer);
    setMarkers([]); // Reset markers
    setSelectedMarkerId(null);
  };

  const runAnalysis = async () => {
    if (!audioBuffer) return;
    setIsAnalyzing(true);
    setTimeout(async () => {
      const detected = await analyzeBeats(audioBuffer, config);
      setMarkers(detected);
      setIsAnalyzing(false);
    }, 100);
  };

  const togglePlayback = useCallback(() => {
    if (!audioBuffer || !audioContextRef.current) return;

    if (isPlaying) {
      sourceNodeRef.current?.stop();
      pauseOffsetRef.current += audioContextRef.current.currentTime - startTimeRef.current;
      cancelAnimationFrame(animationFrameRef.current);
      setIsPlaying(false);
    } else {
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      
      const offset = pauseOffsetRef.current % audioBuffer.duration;
      source.start(0, offset);
      sourceNodeRef.current = source;
      startTimeRef.current = audioContextRef.current.currentTime;
      
      setIsPlaying(true);
      
      const updateProgress = () => {
        const now = audioContextRef.current!.currentTime;
        const elapsed = (now - startTimeRef.current + offset) % audioBuffer.duration;
        setCurrentTime(elapsed);
        animationFrameRef.current = requestAnimationFrame(updateProgress);
      };
      updateProgress();

      source.onended = () => {
        if (source === sourceNodeRef.current) {
            setIsPlaying(false);
            cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }
  }, [isPlaying, audioBuffer]);

  const deleteMarker = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setMarkers(prev => prev.filter(m => m.id !== id));
    if (selectedMarkerId === id) setSelectedMarkerId(null);
  };

  const addMarkerManual = () => {
    const newMarker: Marker = {
      id: Math.random().toString(36).substr(2, 9),
      time: parseFloat(currentTime.toFixed(3)),
      label: `Manual Beat`,
      color: '#ec4899'
    };
    setMarkers(prev => [...prev, newMarker].sort((a, b) => a.time - b.time));
  };

  const jumpToMarker = (id: string, time: number) => {
    setSelectedMarkerId(id);
    setCurrentTime(time);
    pauseOffsetRef.current = time;
    
    if (isPlaying && audioContextRef.current && audioBuffer) {
      sourceNodeRef.current?.stop();
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.start(0, time);
      sourceNodeRef.current = source;
      startTimeRef.current = audioContextRef.current.currentTime;
      
      source.onended = () => {
        if (source === sourceNodeRef.current) {
            setIsPlaying(false);
            cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }
  };

  return (
    <div "min-h-screen p-4 md:p-8 flex flex-col max-w-7xl mx-auto">
      {/* Help Modal */}
      {showHelp && (
        <div "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div "bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-8 max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl">
            <div "flex justify-between items-center mb-6">
              <h2 "text-2xl font-bold text-white">Guía de Importación Adobe</h2>
              <button onClick={() => setShowHelp(false)} "text-slate-400 hover:text-white transition-colors">
                <i "fa-solid fa-times text-xl"></i>
              </button>
            </div>
            
            <div "space-y-8">
              <section "bg-purple-900/10 p-4 rounded-xl border border-purple-500/20">
                <div "flex items-center gap-3 mb-3">
                  <div "w-8 h-8 bg-purple-600 rounded flex items-center justify-center font-bold text-white">Pr</div>
                  <h3 "text-xl font-bold text-purple-400">Adobe Premiere Pro</h3>
                </div>
                <ol "list-decimal list-inside space-y-2 text-slate-300 ml-2">
                  <li>Exporta el archivo <b>XML</b> desde esta app.</li>
                  <li>En Premiere Pro, ve a <b>Archivo > Importar...</b> (o Ctrl+I).</li>
                  <li>Selecciona el archivo XML descargado.</li>
                  <li>Premiere creará una nueva <b>Secuencia</b> que contiene todos los marcadores en su posición exacta.</li>
                  <li>Puedes copiar estos marcadores a tu secuencia principal o editar directamente en la nueva.</li>
                </ol>
                <p "mt-3 text-xs text-slate-500 italic">* Nota: Al importar un XML, los marcadores vienen vinculados a la línea de tiempo de la secuencia generada.</p>
              </section>

              <section "bg-indigo-900/10 p-4 rounded-xl border border-indigo-500/20">
                <div "flex items-center gap-3 mb-3">
                  <div "w-8 h-8 bg-indigo-600 rounded flex items-center justify-center font-bold text-white">Ae</div>
                  <h3 "text-xl font-bold text-indigo-400">Adobe After Effects</h3>
                </div>
                <ol "list-decimal list-inside space-y-2 text-slate-300 ml-2">
                  <li>Exporta el archivo <b>JSX</b> desde esta app.</li>
                  <li>En After Effects, <b>selecciona la capa</b> donde quieras los marcadores.</li>
                  <li>Ve al menú <b>Archivo > Scripts > Ejecutar archivo de script...</b></li>
                  <li>Selecciona el archivo .jsx descargado. ¡Listo!</li>
                </ol>
              </section>
            </div>

            <button 
              onClick={() => setShowHelp(false)}
              "mt-8 w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header "flex justify-between items-center mb-8">
        <div>
          <h1 "text-3xl font-extrabold bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
            BEATMARKER PRO
          </h1>
          <p "text-slate-400 text-sm">Herramienta de Análisis para Adobe Sync</p>
        </div>
        <div "flex gap-4">
           <button 
              onClick={() => setShowHelp(true)}
              "text-slate-400 hover:text-blue-400 transition-colors flex items-center gap-2 text-sm"
           >
              <i "fa-solid fa-circle-question"></i>
              ¿Cómo importar?
           </button>
           {!file ? (
             <label "bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-full cursor-pointer transition-all flex items-center gap-2 shadow-lg">
                <i "fa-solid fa-upload"></i>
                Subir Audio
                <input type="file" "hidden" accept="audio/*" 
             </label>
           ) : (
             <button 
                onClick={() => setFile(null)}
                "bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-full transition-colors flex items-center gap-2 border border-slate-700"
             >
                Cambiar Audio
             </button>
           )}
        </div>
      </header>

      {!file ? (
        <div "flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-700 rounded-2xl bg-slate-800/50">
          <div "w-20 h-20 bg-slate-700 rounded-full flex items-center justify-center mb-4">
             <i "fa-solid fa-music text-3xl text-slate-400"></i>
          </div>
          <h2 "text-xl font-semibold mb-2">Sube tu audio</h2>
          <p "text-slate-400 max-w-md text-center mb-6">
            Analiza archivos MP3 o WAV para detectar el ritmo y exportar marcadores listos para editar.
          </p>
          <label "bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl cursor-pointer transition-all flex items-center gap-3 shadow-xl hover:scale-105 font-bold">
            <i "fa-solid fa-plus"></i>
            Seleccionar archivo
            <input type="file" "hidden" accept="audio/*" 
          </label>
        </div>
      ) : (
        <div "grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 overflow-hidden">
          
          {/* Main Controls & Waveform Simulation */}
          <div "lg:col-span-8 flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2">
            
            {/* Waveform Visualization Area */}
            <div "bg-slate-900 border border-slate-800 rounded-xl p-6 relative overflow-hidden shadow-xl">
                <div "flex justify-between items-center mb-6">
                    <span "text-xs font-mono text-blue-400 bg-blue-400/10 px-2 py-1 rounded">
                      ACTUAL: {formatTime(currentTime)}
                    </span>
                    <span "text-xs font-mono text-slate-500">
                      TOTAL: {audioBuffer ? formatTime(audioBuffer.duration) : '00:00:00:00'}
                    </span>
                </div>
                
                {/* Visual Waveform (Simulated) */}
                <div "h-48 w-full bg-slate-950/50 rounded flex items-center gap-[1px] px-2 overflow-hidden relative group border border-white/5">
                    {/* Markers on timeline */}
                    {markers.map(m => (
                        <div 
                          key={m.id}
                          {`absolute top-0 bottom-0 w-[2px] z-10 transition-colors cursor-pointer hover:bg-white ${selectedMarkerId === m.id ? 'opacity-100' : 'opacity-50'}`}
                          style={{ 
                            left: `${(m.time / (audioBuffer?.duration || 1)) * 100}%`,
                            backgroundColor: m.color
                          }}
                          onClick={() => jumpToMarker(m.id, m.time)}
                        >
                          <div {`absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full ${selectedMarkerId === m.id ? 'scale-125 shadow-lg' : 'scale-100'}`} style={{backgroundColor: m.color}}></div>
                        </div>
                    ))}

                    {/* Progress Bar */}
                    <div 
                        "absolute top-0 bottom-0 w-1 bg-yellow-400 z-20 shadow-[0_0_10px_rgba(250,204,21,0.5)]"
                        style={{ left: `${(currentTime / (audioBuffer?.duration || 1)) * 100}%` }}
                    />

                    {/* Simple Waveform Drawing (CSS Bars) */}
                    {Array.from({length: 120}).map((_, i) => {
                        const height = 10 + Math.random() * 80;
                        return (
                            <div 
                                key={i} 
                                "flex-1 bg-slate-700 min-w-[2px] transition-all"
                                style={{ height: `${height}%`, opacity: 0.5 }}
                            />
                        );
                    })}
                </div>

                <div "flex justify-center gap-6 mt-6">
                    <button 
                        onClick={() => { pauseOffsetRef.current = 0; setCurrentTime(0); if(isPlaying) togglePlayback(); setSelectedMarkerId(null); }}
                        "p-3 rounded-full hover:bg-slate-800 text-slate-400 transition-colors"
                        title="Reiniciar"
                    >
                        <i "fa-solid fa-backward-step text-xl"></i>
                    </button>
                    <button 
                        onClick={togglePlayback}
                        "w-16 h-16 bg-blue-600 hover:bg-blue-500 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-all"
                    >
                        <i {`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'} text-2xl text-white`}></i>
                    </button>
                    <button 
                        onClick={addMarkerManual}
                        "p-3 rounded-full hover:bg-slate-800 text-slate-400 transition-colors"
                        title="Añadir marcador manual"
                    >
                        <i "fa-solid fa-plus text-2xl"></i>
                    </button>
                </div>
            </div>

            {/* Analysis Configuration */}
            <div "bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
                <h3 "text-lg font-semibold mb-6 flex items-center gap-2">
                    <i "fa-solid fa-sliders text-blue-500"></i>
                    Ajustes de Detección
                </h3>
                <div "grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <div "space-y-4">
                        <label "block">
                            <div "flex justify-between text-sm text-slate-400 mb-2">
                                <span>Sensibilidad (Umbral)</span>
                                <span>{Math.round(config.sensitivity * 100)}%</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" 
                                max="1" 
                                step="0.01" 
                                value={config.sensitivity}
                                onChange={(e) => setConfig(prev => ({...prev, sensitivity: parseFloat(e.target.value)}))}
                                "w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                        </label>
                        <label "block">
                            <div "flex justify-between text-sm text-slate-400 mb-2">
                                <span>Distancia Mín. (Segundos)</span>
                                <span>{config.minDistance}s</span>
                            </div>
                            <input 
                                type="range" 
                                min="0.05" 
                                max="2" 
                                step="0.05" 
                                value={config.minDistance}
                                onChange={(e) => setConfig(prev => ({...prev, minDistance: parseFloat(e.target.value)}))}
                                "w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                        </label>
                    </div>
                    <div "flex flex-col justify-center gap-4">
                        <label "flex items-center gap-3 cursor-pointer group">
                            <div {`w-12 h-6 rounded-full p-1 transition-colors ${config.aggressiveMode ? 'bg-blue-600' : 'bg-slate-700'}`} onClick={() => setConfig(prev => ({...prev, aggressiveMode: !prev.aggressiveMode}))}>
                                <div {`bg-white w-4 h-4 rounded-full transition-transform ${config.aggressiveMode ? 'translate-x-6' : 'translate-x-0'}`}></div>
                            </div>
                            <span "text-sm font-medium group-hover:text-blue-400 transition-colors">Modo Agresivo (Detectar golpes suaves)</span>
                        </label>
                        <p "text-xs text-slate-500 italic">
                            Usa el modo estricto para música electrónica o rítmica clara. Usa agresivo para scores de cine o voces.
                        </p>
                    </div>
                </div>

                <div "flex gap-4">
                    <button 
                        onClick={runAnalysis}
                        disabled={isAnalyzing}
                        {`flex-1 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${isAnalyzing ? 'bg-slate-800 text-slate-600' : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-lg active:scale-[0.98]'}`}
                    >
                        {isAnalyzing ? (
                            <>
                                <i "fa-solid fa-circle-notch fa-spin"></i>
                                Analizando onda...
                            </>
                        ) : (
                            <>
                                <i "fa-solid fa-wand-magic-sparkles"></i>
                                INICIAR AUTO-DETECCIÓN
                            </>
                        )}
                    </button>
                </div>
            </div>
          </div>

          {/* Sidebar - Marker List & Export */}
          <div "lg:col-span-4 flex flex-col gap-6 h-full max-h-[calc(100vh-160px)]">
            
            {/* Markers Panel - Expandable */}
            <div "flex-1 bg-slate-900 border border-slate-800 rounded-xl flex flex-col overflow-hidden shadow-2xl min-h-0">
                <div "p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 shrink-0">
                    <h3 "font-bold flex items-center gap-2">
                        <i "fa-solid fa-list text-blue-400"></i>
                        Marcadores ({markers.length})
                    </h3>
                    {markers.length > 0 && (
                      <button 
                          onClick={() => { setMarkers([]); setSelectedMarkerId(null); }}
                          "text-xs text-red-400 hover:text-red-300 transition-colors uppercase font-bold tracking-tighter"
                      >
                          Borrar Todo
                      </button>
                    )}
                </div>
                
                <div "flex-1 overflow-y-auto custom-scrollbar p-2">
                    {markers.length === 0 ? (
                        <div "h-full flex flex-col items-center justify-center p-8 opacity-40">
                            <i "fa-solid fa-bolt-auto text-4xl mb-4 text-slate-600"></i>
                            <p "text-sm text-center italic">Sin marcadores detectados.</p>
                        </div>
                    ) : (
                        <div "space-y-1">
                            {markers.map((m, idx) => (
                                <div 
                                    key={m.id} 
                                    onClick={() => jumpToMarker(m.id, m.time)}
                                    {`group flex items-center justify-between p-3 rounded-lg transition-all border cursor-pointer ${selectedMarkerId === m.id ? 'bg-blue-600/20 border-blue-500/50' : 'bg-slate-800/30 border-transparent hover:bg-slate-800/80 hover:border-slate-700'}`}
                                >
                                    <div "flex items-center gap-3">
                                        <div {`w-1 h-6 rounded-full transition-all ${selectedMarkerId === m.id ? 'scale-y-110' : ''}`} style={{backgroundColor: m.color}}></div>
                                        <div>
                                            <p "text-xs font-mono text-slate-500">#{idx + 1}</p>
                                            <p {`text-sm font-bold transition-colors ${selectedMarkerId === m.id ? 'text-white' : 'text-slate-300'}`}>{m.label}</p>
                                        </div>
                                    </div>
                                    <div "flex items-center gap-4">
                                        <span {`text-xs font-mono px-2 py-1 rounded transition-colors ${selectedMarkerId === m.id ? 'bg-blue-500 text-white font-bold' : 'text-blue-400 bg-blue-400/10 group-hover:bg-blue-400/20'}`}>
                                            {m.time.toFixed(3)}s
                                        </span>
                                        <button 
                                            onClick={(e) => deleteMarker(e, m.id)}
                                            "opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all p-1"
                                        >
                                            <i "fa-solid fa-trash-can"></i>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Export Panel - Fixed Bottom in Sidebar */}
            <div "bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl shrink-0">
                <div "flex justify-between items-center mb-4">
                  <h4 "text-xs font-bold text-slate-500 uppercase tracking-widest">Exportar para Adobe</h4>
                  <button onClick={() => setShowHelp(true)} "text-[10px] text-blue-400 hover:underline">¿Ayuda?</button>
                </div>
                <div "grid grid-cols-1 gap-2">
                    <button 
                        disabled={markers.length === 0}
                        onClick={() => exportMarkers(markers, ExportFormat.PREMIERE_XML, file?.name || 'audio')}
                        "w-full p-3 text-left rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-slate-700 flex items-center gap-3 group"
                    >
                        <div "w-10 h-10 bg-purple-600/20 rounded flex items-center justify-center text-purple-400 font-bold group-hover:bg-purple-600 group-hover:text-white transition-all shadow-inner">
                            Pr
                        </div>
                        <div>
                            <p "text-sm font-bold">Premiere Pro (XML)</p>
                            <p "text-[10px] text-slate-500 italic">Archivo > Importar en Premiere</p>
                        </div>
                    </button>
                    <button 
                        disabled={markers.length === 0}
                        onClick={() => exportMarkers(markers, ExportFormat.AFTER_EFFECTS_JS, file?.name || 'audio')}
                        "w-full p-3 text-left rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-slate-700 flex items-center gap-3 group"
                    >
                        <div "w-10 h-10 bg-indigo-600/20 rounded flex items-center justify-center text-indigo-400 font-bold group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner">
                            Ae
                        </div>
                        <div>
                            <p "text-sm font-bold">After Effects (JSX)</p>
                            <p "text-[10px] text-slate-500 italic">Ejecutar como Script</p>
                        </div>
                    </button>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer Info */}
      <footer "mt-8 pt-8 border-t border-slate-800/50 text-center flex flex-col gap-2">
        <p "text-slate-500 text-xs">
          &copy; 2025 BeatMarker Pro. Optimizado para flujos creativos de alto rendimiento.
        </p>
        <p "text-slate-600 text-[10px] font-medium uppercase tracking-[0.2em]">
          Hecho por Isaac Pacheco 🦝
        </p>
      </footer>
    </div>
  );
};

export default App;

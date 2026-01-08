
import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Wand2, History, X, Download, RefreshCcw, LayoutPanelLeft, Aperture, FlipHorizontal, Smartphone } from 'lucide-react';
import { Button } from './components/Button';
import { geminiService } from './services/geminiService';
import { AppStatus, GenerationRecord } from './types';
import { DEFAULT_PROMPT, LOADING_MESSAGES } from './constants';

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [history, setHistory] = useState<GenerationRecord[]>([]);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Listen for PWA installation event
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });

    // Load history from local storage
    const saved = localStorage.getItem('noir_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }
  }, []);

  useEffect(() => {
    if (history.length > 0) {
      localStorage.setItem('noir_history', JSON.stringify(history));
    }
  }, [history]);

  useEffect(() => {
    let interval: any;
    if (status === AppStatus.GENERATING) {
      interval = setInterval(() => {
        setLoadingMsgIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [status]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setOriginalImage(e.target?.result as string);
        setGeneratedImage(null);
        setStatus(AppStatus.IDLE);
        setIsCameraOpen(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    try {
      setIsCameraOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: cameraFacing },
        audio: false 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access denied:", err);
      setErrorMessage("Camera access denied. Please check permissions.");
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
  };

  const flipCamera = async () => {
    stopCamera();
    setCameraFacing(prev => prev === 'user' ? 'environment' : 'user');
    setTimeout(startCamera, 100);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (cameraFacing === 'user') {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setOriginalImage(dataUrl);
        setGeneratedImage(null);
        stopCamera();
      }
    }
  };

  const handleGenerate = async () => {
    if (!originalImage) return;
    setStatus(AppStatus.GENERATING);
    setErrorMessage(null);
    try {
      const result = await geminiService.transformPortrait(originalImage, prompt);
      if (result) {
        setGeneratedImage(result);
        const newRecord: GenerationRecord = {
          id: Date.now().toString(),
          originalImage,
          generatedImage: result,
          prompt,
          timestamp: Date.now(),
        };
        setHistory((prev) => [newRecord, ...prev]);
        setStatus(AppStatus.IDLE);
        if (window.innerWidth < 1024) {
           const canvasElement = document.getElementById('output-canvas');
           canvasElement?.scrollIntoView({ behavior: 'smooth' });
        }
      } else {
        throw new Error("Failed to generate image.");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Something went wrong during generation.");
      setStatus(AppStatus.ERROR);
    }
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = `noir-portrait-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearWorkspace = () => {
    setOriginalImage(null);
    setGeneratedImage(null);
    setStatus(AppStatus.IDLE);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen noir-gradient flex flex-col selection:bg-white selection:text-black pb-20 lg:pb-0">
      <nav className="border-b border-neutral-800 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <Camera className="w-5 h-5 text-black" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">NOIR <span className="text-neutral-500 font-light hidden sm:inline">STUDIO</span></h1>
          </div>
          <div className="flex items-center gap-2">
            {deferredPrompt && (
              <Button variant="outline" size="sm" onClick={handleInstallClick} className="hidden sm:inline-flex border-white/20">
                <Smartphone className="w-4 h-4 mr-2" />
                Install App
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}>
              <History className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">History</span>
            </Button>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        <div className="lg:col-span-4 space-y-6">
          <div className="glass-card p-5 lg:p-6 rounded-3xl space-y-6 lg:sticky lg:top-24">
            <div>
              <label className="text-xs font-semibold text-neutral-500 uppercase tracking-widest block mb-4">Input Portrait</label>
              {!originalImage ? (
                <div className="space-y-3">
                  {isCameraOpen ? (
                    <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-black border border-neutral-800 shadow-2xl">
                      <video ref={videoRef} autoPlay playsInline className={`w-full h-full object-cover ${cameraFacing === 'user' ? '-scale-x-100' : ''}`} />
                      <div className="absolute bottom-6 left-0 right-0 flex justify-center items-center gap-6">
                        <button onClick={flipCamera} className="p-4 bg-white/10 backdrop-blur-md rounded-full text-white ring-1 ring-white/20 active:bg-white/30 transition-colors"><FlipHorizontal className="w-6 h-6" /></button>
                        <button onClick={capturePhoto} className="w-20 h-20 bg-white rounded-full flex items-center justify-center border-8 border-neutral-800 active:scale-95 transition-transform shadow-xl"><Aperture className="w-10 h-10 text-black" /></button>
                        <button onClick={stopCamera} className="p-4 bg-red-500/80 backdrop-blur-md rounded-full text-white ring-1 ring-white/20 active:bg-red-600 transition-colors"><X className="w-6 h-6" /></button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div onClick={startCamera} className="aspect-[3/4] rounded-2xl border border-neutral-800 hover:border-neutral-600 flex flex-col items-center justify-center cursor-pointer bg-neutral-900/30 transition-all active:scale-[0.98]">
                        <Camera className="w-6 h-6 text-neutral-400" /><p className="mt-2 text-xs text-neutral-400 font-medium">Take Photo</p>
                      </div>
                      <div onClick={() => fileInputRef.current?.click()} className="aspect-[3/4] rounded-2xl border border-neutral-800 hover:border-neutral-600 flex flex-col items-center justify-center cursor-pointer bg-neutral-900/30 transition-all active:scale-[0.98]">
                        <Upload className="w-6 h-6 text-neutral-400" /><p className="mt-2 text-xs text-neutral-400 font-medium">Upload File</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative aspect-[3/4] rounded-2xl overflow-hidden group shadow-2xl ring-1 ring-white/10">
                  <img src={originalImage} className="w-full h-full object-cover" alt="Source" />
                  <button onClick={clearWorkspace} className="absolute top-3 right-3 p-2 bg-black/60 backdrop-blur-md rounded-full text-white border border-white/10 active:scale-90 transition-transform"><X className="w-5 h-5" /></button>
                </div>
              )}
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-widest block mb-3">Cinematic Directive</label>
                <textarea 
                  value={prompt} 
                  onChange={(e) => setPrompt(e.target.value)} 
                  rows={4} 
                  className="w-full bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 text-sm text-neutral-300 focus:outline-none focus:ring-1 focus:ring-white/20 resize-none leading-relaxed transition-all" 
                  placeholder="Describe the cinematic style..." 
                />
              </div>

              <Button 
                className="w-full py-5 text-base shadow-xl" 
                size="lg" 
                onClick={handleGenerate} 
                isLoading={status === AppStatus.GENERATING} 
                disabled={!originalImage}
              >
                <Wand2 className="w-5 h-5 mr-3" /> Develop Masterpiece
              </Button>
            </div>

            {errorMessage && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-3">
                <div className="mt-0.5">⚠️</div><p>{errorMessage}</p>
              </div>
            )}
          </div>
        </div>

        <div id="output-canvas" className="lg:col-span-8">
          <div className="glass-card rounded-3xl min-h-[500px] flex flex-col p-5 lg:p-8 bg-neutral-900/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <h2 className="text-2xl italic font-serif tracking-tight">Masterpiece Canvas</h2>
              {generatedImage && (
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm" onClick={handleDownload} className="flex-1 sm:flex-initial border-white/10"><Download className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Export</span></Button>
                  <Button variant="secondary" size="sm" onClick={handleGenerate} className="flex-1 sm:flex-initial bg-neutral-800 border-white/5"><RefreshCcw className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Refine</span></Button>
                </div>
              )}
            </div>

            <div className="flex-1 flex items-center justify-center bg-black/40 rounded-2xl relative overflow-hidden border border-white/5 min-h-[450px] shadow-inner">
              {status === AppStatus.GENERATING ? (
                <div className="flex flex-col items-center gap-6 animate-pulse px-6">
                  <div className="w-16 h-16 lg:w-20 lg:h-20 border-4 border-t-white border-white/10 rounded-full animate-spin"></div>
                  <div className="text-center">
                    <p className="text-lg font-medium text-white tracking-tight">{LOADING_MESSAGES[loadingMsgIndex]}</p>
                    <p className="text-xs lg:text-sm text-neutral-500 mt-2 italic font-serif">Gemini 2.5 is sculpting your vision</p>
                  </div>
                </div>
              ) : generatedImage ? (
                <div className="relative group w-full h-full flex items-center justify-center p-4">
                   <img src={generatedImage} className="max-h-[75vh] w-auto shadow-2xl rounded-sm ring-1 ring-white/10" alt="Generated Masterpiece" />
                   <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur rounded-full px-5 py-2 border border-white/10 flex items-center gap-3 shadow-2xl">
                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>
                    <span className="text-[10px] uppercase tracking-widest text-neutral-300 font-medium">Developed in Studio</span>
                  </div>
                </div>
              ) : (
                <div className="text-center opacity-30 px-8">
                   <LayoutPanelLeft className="w-16 h-16 mx-auto mb-6 text-neutral-400" />
                   <p className="text-xl italic font-serif text-neutral-400">Your vision will appear here</p>
                   <p className="mt-4 text-xs text-neutral-600 max-w-xs mx-auto">Upload or capture a portrait to begin the transformation.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {history.length > 0 && (
        <section className="bg-black py-16 lg:py-24 border-t border-neutral-900">
          <div className="max-w-7xl mx-auto px-4 lg:px-6">
            <div className="flex items-end justify-between mb-10 lg:mb-14">
              <div>
                <h2 className="text-3xl lg:text-4xl italic font-serif mb-3">Studio Archives</h2>
                <p className="text-neutral-500 text-sm">A collection of your refined monochrome works.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-8">
              {history.map((item) => (
                <div key={item.id} className="group glass-card rounded-2xl overflow-hidden hover:scale-[1.03] transition-all duration-500 shadow-xl">
                  <div className="aspect-[3/4] relative">
                    <img src={item.generatedImage} className="w-full h-full object-cover" alt="History" />
                    <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity p-5 flex flex-col justify-end gap-3">
                       <Button variant="primary" size="sm" className="w-full text-xs font-semibold" onClick={() => { setGeneratedImage(item.generatedImage); setOriginalImage(item.originalImage); setPrompt(item.prompt); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Restore</Button>
                       <Button variant="outline" size="sm" className="w-full text-xs border-white/10" onClick={() => { const link = document.createElement('a'); link.href = item.generatedImage; link.download = `archive-${item.id}.png`; link.click(); }}>Download</Button>
                    </div>
                  </div>
                  <div className="p-3 bg-neutral-900/20 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[10px] text-neutral-500 uppercase tracking-tighter">{new Date(item.timestamp).toLocaleDateString()}</span>
                    <span className="text-[10px] text-neutral-600 italic">Portrait</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Mobile Sticky Navigation for Install */}
      {deferredPrompt && (
        <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm">
          <div className="glass-card p-4 rounded-2xl shadow-2xl flex items-center justify-between border-white/20">
            <div className="flex items-center gap-3">
              <Smartphone className="w-5 h-5 text-neutral-400" />
              <div>
                <p className="text-xs font-bold text-white">Noir Studio</p>
                <p className="text-[10px] text-neutral-500">Install to your home screen</p>
              </div>
            </div>
            <Button size="sm" onClick={handleInstallClick}>Install</Button>
          </div>
        </div>
      )}

      <footer className="py-12 lg:py-20 border-t border-neutral-900 text-center opacity-60">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
          <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold">Studio Online</span>
        </div>
        <p className="text-neutral-500 text-[10px] lg:text-xs">Noir Portrait Studio • Cinematic AI Transformation • © 2025</p>
      </footer>
    </div>
  );
};

export default App;

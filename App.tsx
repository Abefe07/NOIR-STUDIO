
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Upload, Wand2, History, X, Download, RefreshCcw, LayoutPanelLeft, Aperture, FlipHorizontal } from 'lucide-react';
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Cycle through loading messages
  useEffect(() => {
    let interval: any;
    if (status === AppStatus.GENERATING) {
      interval = setInterval(() => {
        setLoadingMsgIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [status]);

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
    // Small timeout to ensure cleanup
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
        // If front camera, horizontal flip for more natural capture
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
        // Scroll to output on mobile
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
      {/* Navigation */}
      <nav className="border-b border-neutral-800 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <Camera className="w-5 h-5 text-black" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">NOIR <span className="text-neutral-500 font-light hidden sm:inline">STUDIO</span></h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}>
              <History className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">History</span>
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        
        {/* Left: Input & Controls */}
        <div className="lg:col-span-4 space-y-6">
          <div className="glass-card p-5 lg:p-6 rounded-3xl space-y-6 lg:sticky lg:top-24">
            <div>
              <label className="text-xs font-semibold text-neutral-500 uppercase tracking-widest block mb-4">Input Portrait</label>
              
              {!originalImage ? (
                <div className="space-y-3">
                  {isCameraOpen ? (
                    <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-black border border-neutral-800">
                      <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        className={`w-full h-full object-cover ${cameraFacing === 'user' ? '-scale-x-100' : ''}`}
                      />
                      <div className="absolute bottom-6 left-0 right-0 flex justify-center items-center gap-6">
                        <button 
                          onClick={flipCamera}
                          className="p-3 bg-white/10 backdrop-blur-md rounded-full text-white active:scale-90 transition-transform"
                        >
                          <FlipHorizontal className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={capturePhoto}
                          className="w-16 h-16 bg-white rounded-full flex items-center justify-center border-4 border-neutral-400 active:scale-90 transition-transform"
                        >
                          <Aperture className="w-8 h-8 text-black" />
                        </button>
                        <button 
                          onClick={stopCamera}
                          className="p-3 bg-red-500/80 backdrop-blur-md rounded-full text-white active:scale-90 transition-transform"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div 
                        onClick={startCamera}
                        className="aspect-[3/4] rounded-2xl border border-neutral-800 hover:border-neutral-600 transition-colors flex flex-col items-center justify-center cursor-pointer group bg-neutral-900/30"
                      >
                        <Camera className="w-6 h-6 text-neutral-400 group-hover:scale-110 transition-transform" />
                        <p className="mt-2 text-xs text-neutral-400 font-medium">Take Photo</p>
                      </div>
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-[3/4] rounded-2xl border border-neutral-800 hover:border-neutral-600 transition-colors flex flex-col items-center justify-center cursor-pointer group bg-neutral-900/30"
                      >
                        <Upload className="w-6 h-6 text-neutral-400 group-hover:scale-110 transition-transform" />
                        <p className="mt-2 text-xs text-neutral-400 font-medium">Upload File</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative aspect-[3/4] rounded-2xl overflow-hidden group">
                  <img src={originalImage} className="w-full h-full object-cover" alt="Source" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none group-hover:pointer-events-auto">
                    <Button variant="danger" size="sm" onClick={clearWorkspace}>
                      <X className="w-4 h-4 mr-2" />
                      Remove
                    </Button>
                  </div>
                  {/* Mobile remove button - always visible slightly */}
                  <button 
                    onClick={clearWorkspace}
                    className="lg:hidden absolute top-2 right-2 p-2 bg-black/60 rounded-full text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
                accept="image/*"
              />
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-500 uppercase tracking-widest block mb-3">Cinematic Directive</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={5}
                className="w-full bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 text-sm text-neutral-300 focus:outline-none focus:ring-1 focus:ring-white/20 resize-none leading-relaxed transition-all"
                placeholder="Describe the cinematic style..."
              />
            </div>

            <Button 
              className="w-full py-4 text-base" 
              size="lg" 
              onClick={handleGenerate} 
              isLoading={status === AppStatus.GENERATING}
              disabled={!originalImage}
            >
              <Wand2 className="w-5 h-5 mr-2" />
              Develop Portrait
            </Button>

            {errorMessage && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-3">
                <div className="mt-0.5">⚠️</div>
                <p>{errorMessage}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Output Canvas */}
        <div id="output-canvas" className="lg:col-span-8">
          <div className="glass-card rounded-3xl min-h-[500px] flex flex-col p-5 lg:p-8 bg-neutral-900/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <h2 className="text-2xl italic font-serif">Masterpiece Canvas</h2>
              {generatedImage && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleDownload} className="flex-1 sm:flex-initial">
                    <Download className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Download</span>
                  </Button>
                  <Button variant="secondary" size="sm" onClick={handleGenerate} className="flex-1 sm:flex-initial">
                    <RefreshCcw className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Refine</span>
                  </Button>
                </div>
              )}
            </div>

            <div className="flex-1 flex items-center justify-center bg-black/40 rounded-2xl relative overflow-hidden border border-white/5 min-h-[400px]">
              {status === AppStatus.GENERATING ? (
                <div className="flex flex-col items-center gap-6 animate-pulse px-6">
                  <div className="w-16 h-16 lg:w-20 lg:h-20 border-4 border-t-white border-white/10 rounded-full animate-spin"></div>
                  <div className="text-center">
                    <p className="text-lg font-medium text-white">{LOADING_MESSAGES[loadingMsgIndex]}</p>
                    <p className="text-xs lg:text-sm text-neutral-500 mt-1 italic font-serif">Gemini 2.5 is painting your vision</p>
                  </div>
                </div>
              ) : generatedImage ? (
                <div className="relative group w-full h-full flex items-center justify-center p-4">
                   <img 
                    src={generatedImage} 
                    className="max-h-[70vh] w-auto shadow-2xl rounded shadow-black/80 ring-1 ring-white/10" 
                    alt="Generated Masterpiece" 
                  />
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur rounded-full px-4 py-1.5 border border-white/10 flex items-center gap-4">
                    <span className="text-[10px] uppercase tracking-widest text-neutral-400">Cinematic Result</span>
                  </div>
                </div>
              ) : (
                <div className="text-center opacity-30 px-8">
                   <LayoutPanelLeft className="w-12 h-12 lg:w-16 lg:h-16 mx-auto mb-6 text-neutral-400" />
                   <p className="text-lg lg:text-xl italic font-serif text-neutral-400">Your vision will appear here</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* History Section */}
      {history.length > 0 && (
        <section className="bg-black py-16 lg:py-24 border-t border-neutral-900">
          <div className="max-w-7xl mx-auto px-4 lg:px-6">
            <div className="flex items-center justify-between mb-8 lg:mb-12">
              <div>
                <h2 className="text-2xl lg:text-3xl italic font-serif mb-2">Studio Archives</h2>
                <p className="text-neutral-500 text-xs lg:text-sm">Review your previously developed portraits.</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-8">
              {history.map((item) => (
                <div key={item.id} className="group glass-card rounded-2xl overflow-hidden hover:scale-[1.02] transition-all duration-500">
                  <div className="aspect-[3/4] relative">
                    <img src={item.generatedImage} className="w-full h-full object-cover" alt="History" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end">
                      <div className="flex flex-col gap-2">
                         <Button variant="primary" size="sm" className="w-full text-[10px]"
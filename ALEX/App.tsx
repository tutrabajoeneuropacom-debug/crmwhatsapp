
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sender, Message } from './types';
import { GeminiService, decodeBase64Audio, pcmToAudioBuffer, encodePCM } from './geminiService';
import { Search, MoreVertical, Paperclip, Send, Mic, Phone, Video, ChevronLeft, Volume2, VolumeX } from 'lucide-react';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: Sender.ALEX,
      text: 'Hola, soy Alex. Estoy aquí para acompañarte en tu proceso de migración y carrera. ¿Cómo te sientes hoy?',
      timestamp: new Date(),
      type: 'text'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLive, setIsLive] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const liveSessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const gemini = useRef(new GeminiService());

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: Sender.USER,
      text: inputText,
      timestamp: new Date(),
      type: 'text'
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    try {
      const history = messages.slice(-10).map(m => ({
        role: m.sender === Sender.USER ? 'user' : 'model',
        parts: m.text
      }));

      const response = await gemini.current.sendTextMessage(inputText, history);
      
      const alexMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: Sender.ALEX,
        text: response || 'Lo siento, tuve un pequeño problema. ¿Podrías repetirlo?',
        timestamp: new Date(),
        type: 'text'
      };
      setMessages(prev => [...prev, alexMsg]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsTyping(false);
    }
  };

  const toggleLive = async () => {
    if (isLive) {
      liveSessionRef.current?.close?.();
      setIsLive(false);
      audioContextRef.current?.close();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const outCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      setIsLive(true);
      
      const sessionPromise = gemini.current.connectLive({
        onAudio: async (base64) => {
          const data = decodeBase64Audio(base64);
          const buffer = await pcmToAudioBuffer(data, outCtx);
          const source = outCtx.createBufferSource();
          source.buffer = buffer;
          source.connect(outCtx.destination);
          
          nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outCtx.currentTime);
          source.start(nextStartTimeRef.current);
          nextStartTimeRef.current += buffer.duration;
          audioSourcesRef.current.add(source);
          source.onended = () => audioSourcesRef.current.delete(source);
        },
        onInterrupted: () => {
          audioSourcesRef.current.forEach(s => s.stop());
          audioSourcesRef.current.clear();
          nextStartTimeRef.current = 0;
        },
        onTranscription: (text, isUser) => {
          // Optional: update UI with real-time transcription
          console.log(`${isUser ? 'User' : 'Alex'}: ${text}`);
        }
      });

      sessionPromise.then(session => {
        liveSessionRef.current = session;
        const source = audioContextRef.current!.createMediaStreamSource(stream);
        const processor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
        
        processor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          const base64 = encodePCM(inputData);
          session.sendRealtimeInput({
            media: { data: base64, mimeType: 'audio/pcm;rate=24000' }
          });
        };

        source.connect(processor);
        processor.connect(audioContextRef.current!.destination);
      });

    } catch (err) {
      console.error('Mic error:', err);
      setIsLive(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-200">
      {/* Header */}
      <div className="bg-[#075e54] text-white p-3 flex items-center justify-between shadow-md z-10">
        <div className="flex items-center space-x-3">
          <ChevronLeft className="w-6 h-6 cursor-pointer md:hidden" />
          <div className="relative">
            <img 
              src="https://picsum.photos/seed/alex-mentor/100/100" 
              className="w-10 h-10 rounded-full border border-white/20"
              alt="Alex"
            />
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#075e54] rounded-full"></div>
          </div>
          <div>
            <h1 className="font-semibold text-lg leading-tight">Alex</h1>
            <p className="text-xs text-white/80">Arquitecto de Carreras</p>
          </div>
        </div>
        <div className="flex items-center space-x-5 mr-2">
          <Video className="w-5 h-5 cursor-pointer opacity-80 hover:opacity-100" />
          <Phone className="w-5 h-5 cursor-pointer opacity-80 hover:opacity-100" />
          <MoreVertical className="w-5 h-5 cursor-pointer opacity-80 hover:opacity-100" />
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 whatsapp-bg relative">
        <div className="flex justify-center mb-6">
          <span className="bg-[#d1d7db] text-[11px] px-3 py-1 rounded-md text-gray-600 uppercase tracking-wide font-medium">Hoy</span>
        </div>
        
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex ${msg.sender === Sender.USER ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[75%] px-3 py-2 shadow-sm relative ${msg.sender === Sender.USER ? 'user-bubble' : 'alex-bubble'}`}>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{msg.text}</p>
              <div className="flex justify-end mt-1 items-center space-x-1">
                <span className="text-[10px] text-gray-500">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {msg.sender === Sender.USER && (
                  <svg viewBox="0 0 16 11" width="16" height="11" fill="#53bdeb">
                    <path d="M11.053 1.521L5.617 7.02l-2.47-2.52L1.932 5.7l3.685 3.76 6.643-6.736-1.207-1.203zm4.218 0l-5.436 5.499-1.268-1.265-1.207 1.203 2.475 2.526 6.643-6.736-1.207-1.227z" />
                  </svg>
                )}
              </div>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="alex-bubble px-4 py-2 shadow-sm">
              <div className="flex space-x-1">
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Voice Active Overlay */}
      {isLive && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50 transition-all duration-300">
          <div className="relative">
            <img 
              src="https://picsum.photos/seed/alex-live/300/300" 
              className="w-48 h-48 rounded-full border-4 border-[#25d366] animate-pulse"
              alt="Alex Live"
            />
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-[#25d366] px-4 py-1 rounded-full text-xs font-bold text-white uppercase tracking-widest">
              Live
            </div>
          </div>
          <h2 className="text-white text-2xl font-light mt-8">Hablando con Alex...</h2>
          <p className="text-white/60 text-sm mt-2 text-center max-w-xs px-4">
            Tu micrófono está activo. Alex te escucha y te responderá en tiempo real.
          </p>
          <div className="flex space-x-6 mt-12">
            <button 
              onClick={toggleLive}
              className="bg-red-500 hover:bg-red-600 text-white p-4 rounded-full shadow-lg transition-transform active:scale-95"
            >
              <Phone className="w-8 h-8 rotate-[135deg]" />
            </button>
          </div>
        </div>
      )}

      {/* Input Section */}
      <div className="bg-[#f0f2f5] p-2 flex items-center space-x-2 border-t border-gray-300">
        <button className="p-2 text-gray-500 hover:text-gray-700 transition-colors">
          <Paperclip className="w-6 h-6" />
        </button>
        <div className="flex-1 bg-white rounded-lg p-1 shadow-sm border border-transparent focus-within:border-[#25d366] transition-all">
          <input 
            type="text" 
            placeholder="Escribe un mensaje..."
            className="w-full px-3 py-2 outline-none text-sm"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
        </div>
        {inputText.trim() ? (
          <button 
            onClick={handleSend}
            className="bg-[#00a884] text-white p-2.5 rounded-full shadow-md hover:bg-[#008f72] active:scale-95 transition-all"
          >
            <Send className="w-5 h-5" />
          </button>
        ) : (
          <button 
            onClick={toggleLive}
            className="bg-[#00a884] text-white p-2.5 rounded-full shadow-md hover:bg-[#008f72] active:scale-95 transition-all"
          >
            <Mic className={`w-5 h-5 ${isLive ? 'animate-pulse text-red-200' : ''}`} />
          </button>
        )}
      </div>

      {/* Bottom Bar (Mobile specific safe area) */}
      <div className="h-2 bg-[#f0f2f5] md:hidden"></div>
    </div>
  );
};

export default App;

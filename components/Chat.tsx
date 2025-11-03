
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Chat } from "@google/genai";
import { generateSpeech } from '../services/geminiService';
import type { User, Message } from '../types';
import MessageComponent from './Message';
import TypingIndicator from './TypingIndicator';
import ThemeToggle from './ThemeToggle';
import { SendIcon, MicIcon, LogoutIcon, NewChatIcon, SpeakerWaveIcon, SpeakerXMarkIcon } from './icons';

interface ChatProps {
  user: User;
  onLogout: () => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

// Check for SpeechRecognition API
// FIX: Cast window to `any` to resolve TypeScript errors for SpeechRecognition properties.
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;
if (recognition) {
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
}

// Audio helper functions (as per guidelines)
function decode(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}
  
async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}


const ChatComponent: React.FC<ChatProps> = ({ user, onLogout, theme, toggleTheme }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTtsEnabled, setIsTtsEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem(`ttsEnabled_${user.username}`);
    return saved !== null ? JSON.parse(saved) : false;
  });

  const chatRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const ai = useRef<GoogleGenAI | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextAudioStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  useEffect(() => {
    // Initialize AI client
    if (process.env.API_KEY) {
      ai.current = new GoogleGenAI({ apiKey: process.env.API_KEY });
    } else {
      console.error("API_KEY is not set.");
    }

    // Load chat history from localStorage
    const savedHistory = localStorage.getItem(`chatHistory_${user.username}`);
    if (savedHistory) {
      setMessages(JSON.parse(savedHistory));
    }
  }, [user.username]);

  useEffect(() => {
    // Save chat history to localStorage
    if (messages.length > 0) {
      localStorage.setItem(`chatHistory_${user.username}`, JSON.stringify(messages));
    }
  }, [messages, user.username]);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (!recognition) return;
    
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
    };
    recognition.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(`ttsEnabled_${user.username}`, JSON.stringify(isTtsEnabled));
    if (isTtsEnabled && !audioContextRef.current) {
        try {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        } catch (e) {
            console.error("Web Audio API is not supported in this browser.", e);
            setIsTtsEnabled(false);
        }
    }
  }, [isTtsEnabled, user.username]);

  const playAudio = useCallback(async (base64Audio: string) => {
    if (!audioContextRef.current || !base64Audio) return;

    try {
        const audioData = decode(base64Audio);
        const audioBuffer = await decodeAudioData(audioData, audioContextRef.current, 24000, 1);
        
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);

        const currentTime = audioContextRef.current.currentTime;
        const startTime = Math.max(currentTime, nextAudioStartTimeRef.current);
        
        source.start(startTime);
        nextAudioStartTimeRef.current = startTime + audioBuffer.duration;

        audioSourcesRef.current.add(source);
        source.onended = () => {
            audioSourcesRef.current.delete(source);
        };
    } catch (error) {
        console.error("Error playing audio:", error);
    }
  }, []);

  const handleTts = useCallback(async (text: string) => {
    if (!isTtsEnabled || !text) return;
    const base64Audio = await generateSpeech(text);
    if (base64Audio) {
        playAudio(base64Audio);
    }
  }, [isTtsEnabled, playAudio]);

  const handleSendMessage = useCallback(async () => {
    if (input.trim() === '' || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      parts: [{ text: input }],
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      if (!ai.current) throw new Error("AI client not initialized.");
      if (!chatRef.current) {
         const history = messages.map(msg => ({
             role: msg.role,
             parts: msg.parts,
         }));
         chatRef.current = ai.current.chats.create({
            model: 'gemini-2.5-flash',
            history,
         });
      }
      
      const stream = await chatRef.current.sendMessageStream({ message: input });

      let modelResponseText = '';
      const modelMessage: Message = {
        role: 'model',
        parts: [{ text: '' }],
        timestamp: new Date().toISOString(),
      };
      
      setMessages(prev => [...prev, modelMessage]);

      for await (const chunk of stream) {
        modelResponseText += chunk.text;
        setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage.role === 'model') {
                lastMessage.parts = [{ text: modelResponseText }];
            }
            return newMessages;
        });
      }
      if (isTtsEnabled) {
        handleTts(modelResponseText);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
          role: 'model',
          parts: [{text: 'Sorry, I encountered an error. Please try again.'}],
          timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev.slice(0, -1), errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, isTtsEnabled, handleTts]);

  const handleMicClick = () => {
    if (!recognition) {
        alert("Speech recognition is not supported in your browser.");
        return;
    }
    if (isListening) {
        recognition.stop();
    } else {
        recognition.start();
    }
  };

  const handleNewChat = () => {
    if (window.confirm("Are you sure you want to start a new chat? Your current conversation will be cleared.")) {
        setMessages([]);
        localStorage.removeItem(`chatHistory_${user.username}`);
        chatRef.current = null;
        audioSourcesRef.current.forEach(source => source.stop());
        audioSourcesRef.current.clear();
        nextAudioStartTimeRef.current = 0;
    }
  };

  const toggleTts = () => {
    setIsTtsEnabled(prev => !prev);
  };

  return (
    <div className="flex flex-col h-screen bg-cover bg-center bg-no-repeat" style={{backgroundImage: "url('https://picsum.photos/1920/1080?blur=10')"}}>
      <div className="flex flex-col h-full bg-black/40 backdrop-blur-2xl">
        <header className="flex items-center justify-between p-4 border-b border-white/20 shadow-lg">
          <h1 className="text-2xl font-bold text-white tracking-wider">OIChatBot AI</h1>
          <div className="flex items-center space-x-2 md:space-x-4">
            <span className="text-cyan-300 hidden sm:block">Welcome, {user.username}</span>
            <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
            <button onClick={toggleTts} className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-400" aria-label="Toggle Text-to-Speech">
              {isTtsEnabled ? <SpeakerWaveIcon className="w-6 h-6" /> : <SpeakerXMarkIcon className="w-6 h-6" />}
            </button>
            <button onClick={handleNewChat} className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-400" aria-label="New Chat">
              <NewChatIcon className="w-6 h-6" />
            </button>
            <button onClick={onLogout} className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-400" aria-label="Logout">
              <LogoutIcon className="w-6 h-6" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {messages.map((msg, index) => (
            <MessageComponent key={index} message={msg} />
          ))}
          {isLoading && <div className="flex justify-start"><TypingIndicator /></div>}
          <div ref={messagesEndRef} />
        </main>

        <footer className="p-4 border-t border-white/20">
          <div className="flex items-center space-x-2 md:space-x-4 bg-black/30 backdrop-blur-sm rounded-full border border-white/20 p-2 shadow-inner focus-within:ring-2 focus-within:ring-cyan-400 transition-all duration-300">
            {recognition && (
            <button onClick={handleMicClick} className={`p-3 rounded-full transition-all duration-300 ${isListening ? 'bg-red-500 animate-pulse' : 'bg-cyan-500/50 hover:bg-cyan-500/80'} text-white`}>
              <MicIcon className="w-6 h-6" />
            </button>
            )}
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Type your message..."
              className="flex-1 bg-transparent text-white placeholder-gray-400 focus:outline-none px-2"
              disabled={isLoading}
            />
            <button onClick={handleSendMessage} disabled={isLoading || input.trim() === ''} className="p-3 rounded-full bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white transition-all duration-300 shadow-[0_0_10px_rgba(0,255,255,0.5)] hover:shadow-[0_0_20px_rgba(0,255,255,0.7)]">
              <SendIcon className="w-6 h-6" />
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default ChatComponent;

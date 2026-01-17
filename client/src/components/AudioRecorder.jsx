import React, { useState, useRef } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';

export default function AudioRecorder({ onRecordingComplete, isProcessing }) {
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            chunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                onRecordingComplete(blob);

                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Error accessing microphone: " + err.message);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    return (
        <div className="flex items-center justify-center">
            <button
                type="button" // Prevent form submit if inside form
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isProcessing}
                className={`
          flex items-center justify-center p-4 rounded-full transition-all duration-300
          ${isRecording
                        ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                        : 'bg-emerald-600 hover:bg-emerald-700'
                    }
          ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'opacity-100'}
        `}
            >
                {isProcessing ? (
                    <Loader2 className="animate-spin text-white" size={24} />
                ) : isRecording ? (
                    <Square className="text-white fill-current" size={24} />
                ) : (
                    <Mic className="text-white" size={24} />
                )}
            </button>
            {isRecording && (
                <span className="ml-2 text-xs text-red-400 font-mono animate-pulse">
                    Grabando...
                </span>
            )}
        </div>
    );
}

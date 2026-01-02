import React, { useState, useEffect } from 'react';
import { CHARACTERS } from '../game/Characters';

interface CharacterSelectProps {
    onSelect: (characterId: string) => void;
}

export const CharacterSelect: React.FC<CharacterSelectProps> = ({ onSelect }) => {
    const chars = Object.values(CHARACTERS);
    const [currentIndex, setCurrentIndex] = useState(0);

    const handleNext = () => {
        setCurrentIndex((prev) => (prev + 1) % chars.length);
    };

    const handlePrev = () => {
        setCurrentIndex((prev) => (prev - 1 + chars.length) % chars.length);
    };

    const handleSelect = () => {
        onSelect(chars[currentIndex].id);
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
                handleNext();
            } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
                handlePrev();
            } else if (e.key === 'Enter' || e.key === ' ') {
                handleSelect();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentIndex]); // Re-bind on index change matters less here but good for closure capture if needed, mostly redundant if state uses functional updates but handleSelect needs fresh closure or refs.
    // Actually handleSelect depends on currentIndex, so we need it in dependency or use a ref. 
    // Simplified: re-bind is fine.

    const currentChar = chars[currentIndex];

    // Animation frames logic would go here. 
    // For Hoka's rotation, we'll try a CSS animation with steps() assuming 8 frames for now.
    // If it's a single image for Fresh, it will just show static.

    return (
        <div className="relative w-full h-screen bg-slate-900 flex flex-col items-center justify-center overflow-hidden">
            {/* Background elements */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black opacity-80"></div>

            <h1 className="relative z-10 text-6xl font-black text-white mb-12 tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] italic uppercase">
                Select Your Fighter
            </h1>

            <div className="relative z-10 flex items-center justify-center gap-12">
                {/* Arrow Left */}
                <button
                    onClick={handlePrev}
                    className="p-4 text-white/50 hover:text-white transition-colors hover:scale-110 transform"
                >
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>

                {/* Character Card */}
                <div className="flex flex-col items-center group cursor-pointer" onClick={handleSelect}>
                    <div className="relative w-64 h-64 flex items-center justify-center mb-6 transition-transform transform group-hover:scale-105">
                        {/* Glow effect */}
                        <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>

                        {/* Character Sprite Display */}
                        <div className="relative w-48 h-48 overflow-hidden image-pixelated">
                            {/* We use a div background for sprite animation control */}
                            <div
                                className="w-full h-full bg-no-repeat bg-contain bg-center"
                                style={{
                                    backgroundImage: `url(${currentChar.portrait})`,
                                    backgroundSize: `${currentChar.selectionFrameCount * 100}% 100%`,
                                    animation: `sprite-play ${currentChar.selectionFrameCount * 0.15}s steps(${currentChar.selectionFrameCount}) infinite`,
                                }}
                            ></div>
                        </div>
                    </div>

                    <h2 className="text-4xl font-bold text-white mb-2">{currentChar.name}</h2>
                    <p className="text-gray-400 text-lg max-w-md text-center">{currentChar.description}</p>

                    <div className="mt-8 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xl rounded-sm transition-all shadow-[0_0_20px_rgba(37,99,235,0.5)] hover:shadow-[0_0_30px_rgba(37,99,235,0.8)]">
                        CONFIRM
                    </div>
                </div>

                {/* Arrow Right */}
                <button
                    onClick={handleNext}
                    className="p-4 text-white/50 hover:text-white transition-colors hover:scale-110 transform"
                >
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
            </div>

            {/* Hint */}
            <div className="absolute bottom-8 text-white/30 font-mono text-sm">
                Use Arrow Keys to Rotate • Enter to Select
            </div>

            <style>{`
                @keyframes sprite-play {
                    from { background-position: 0 0; }
                    to { background-position: 100% 0; }
                }
                .image-pixelated {
                    image-rendering: pixelated;
                }
            `}</style>
        </div>
    );
};

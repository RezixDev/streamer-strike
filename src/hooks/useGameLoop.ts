import { useRef, useEffect, useCallback } from 'react';

type GameLoopCallback = (deltaTime: number) => void;

interface UseGameLoopProps {
    onUpdate: GameLoopCallback;
    onDraw: GameLoopCallback;
}

export const useGameLoop = ({ onUpdate, onDraw }: UseGameLoopProps) => {
    const requestRef = useRef<number | undefined>(undefined);
    const previousTimeRef = useRef<number | undefined>(undefined);
    const isRunning = useRef(true);

    const animate = useCallback((time: number) => {
        if (!isRunning.current) return;

        if (previousTimeRef.current !== undefined) {
            const deltaTime = time - previousTimeRef.current;

            // Cap deltaTime to prevent huge jumps if tab was inactive (e.g. max 100ms)
            const cappedDelta = Math.min(deltaTime, 100);

            onUpdate(cappedDelta);
            onDraw(cappedDelta);
        }
        previousTimeRef.current = time;
        requestRef.current = requestAnimationFrame(animate);
    }, [onUpdate, onDraw]);

    useEffect(() => {
        isRunning.current = true;
        requestRef.current = requestAnimationFrame(animate);
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            isRunning.current = false;
        };
    }, [animate]);

    return { isRunning };
};

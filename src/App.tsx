import { useState } from 'react';
import { CanvasGame } from './components/CanvasGame';
import { CharacterSelect } from './components/CharacterSelect';

function App() {
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);

  if (!selectedCharacterId) {
    return <CharacterSelect onSelect={setSelectedCharacterId} />;
  }

  return (
    <CanvasGame characterId={selectedCharacterId} />
  );
}

export default App;

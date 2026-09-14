import { Navigate, useParams } from 'react-router-dom';
import { GameShell } from '../components/game/GameShell';
import { getGame, getLevel } from '../games/registry';
import { useCurrentProfile } from './useCurrentProfile';

export function PlayScreen() {
  const { gameId = '', levelId = '' } = useParams();
  const profile = useCurrentProfile();
  const game = getGame(gameId);
  const level = getLevel(gameId, levelId);
  if (!game || !level) return <Navigate to="/map" replace />;
  return <GameShell key={`${gameId}:${levelId}`} game={game} level={level} profileId={profile.id} />;
}

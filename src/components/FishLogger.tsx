// FishLogger has been deprecated in favour of the new session_events model.
// This stub satisfies existing imports until the new SessionEventLogger is built.

interface FishLoggerProps {
  diaryEntryId: string;
  venue: string;
  venueType?: string;
  onUpdate?: () => void;
}

const FishLogger = (_props: FishLoggerProps) => null;

export default FishLogger;

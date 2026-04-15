import { render, screen } from '@testing-library/react';
import { EpisodeTracker } from '@/components/EpisodeTracker';

describe('EpisodeTracker', () => {
  it('renders all steps properly', () => {
    render(<EpisodeTracker status="recording" />);
    expect(screen.getByText('Recording')).toBeInTheDocument();
    expect(screen.getByText('Editing')).toBeInTheDocument();
    expect(screen.getByText('Podcast Published')).toBeInTheDocument();
    expect(screen.getByText('Video Processing')).toBeInTheDocument();
    expect(screen.getByText('YouTube Published')).toBeInTheDocument();
  });

  it('whitelabels captivate and zernio text perfectly', () => {
    render(<EpisodeTracker status="zernio" />);
    // Testing absence of legacy names
    expect(screen.queryByText(/captivate/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/zernio/i)).not.toBeInTheDocument();
  });
});

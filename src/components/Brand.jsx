import { Layers3 } from 'lucide-react';

export default function Brand({ light = false }) {
  return (
    <div className={`brand ${light ? 'brand-light' : ''}`}>
      <span className="brand-mark"><Layers3 size={21} strokeWidth={2.4} /></span>
      <span>QueueSmart</span>
    </div>
  );
}

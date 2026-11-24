'use client';

import { Suspense } from 'react';
import Queue from './Queue.js';
import { Loading } from '../../../components/ui.js';

export default function QueuePage() {
  return <Suspense fallback={<Loading />}><Queue /></Suspense>;
}

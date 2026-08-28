import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';

import { completeTask } from '../repositories/tasks';
import { reconcileNotifications } from './service';

export function NotificationResponseHandler() {
  const router = useRouter();
  useEffect(() => {
    const handleResponse = (response: Notifications.NotificationResponse) => {
      const taskId = response.notification.request.content.data?.taskId;
      if (typeof taskId !== 'string') return;
      if (response.actionIdentifier === 'complete') {
        void completeTask(taskId).then(() => reconcileNotifications());
      } else {
        router.push({ pathname: '/tasks/[id]', params: { id: taskId, action: response.actionIdentifier === 'delay' ? 'delay' : undefined } });
      }
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) { handleResponse(response); void Notifications.clearLastNotificationResponseAsync(); }
    });
    return () => subscription.remove();
  }, [router]);
  return null;
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { computeProfileComplete } from '../../bootstrap';
import { getFirebaseFirestore } from '../../init';
import { userProfilePath } from '../../paths';
import { queryKeys } from '../../query-keys';
import { type UserProfileInput } from '../../types/profile';

interface UpdateProfileParams {
  uid: string;
  email: string;
  input: UserProfileInput;
}

export function useUpdateProfile(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ uid, email, input }: UpdateProfileParams) => {
      const firestore = getFirebaseFirestore();
      const profileComplete = computeProfileComplete(input);

      await setDoc(
        doc(firestore, userProfilePath(uid)),
        {
          displayName: input.displayName.trim(),
          emoji: input.emoji,
          color: input.color,
          email,
          profileComplete,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      return profileComplete;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.userProfile(variables.uid) });
      queryClient.invalidateQueries({ queryKey: queryKeys.familyMembers(familyId) });
    },
  });
}

import { db, auth } from './firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  FirestoreError,
  Query,
  DocumentReference,
  CollectionReference
} from 'firebase/firestore';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  // Don't report errors if there is no current user (likely logging out or unauthenticated)
  if (!auth.currentUser) return;

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const safeGetDoc = async (ref: DocumentReference) => {
  try {
    return await getDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, ref.path);
  }
};

export const safeGetDocs = async (q: Query) => {
  try {
    return await getDocs(q);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, (q as any).path || 'query');
  }
};

export const safeAddDoc = async (ref: CollectionReference, data: any) => {
  try {
    return await addDoc(ref, data);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, ref.path);
  }
};

export const safeSetDoc = async (ref: DocumentReference, data: any, options?: any) => {
  try {
    return await setDoc(ref, data, options);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, ref.path);
  }
};

export const safeUpdateDoc = async (ref: DocumentReference, data: any) => {
  try {
    return await updateDoc(ref, data);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, ref.path);
  }
};

export const safeDeleteDoc = async (ref: DocumentReference) => {
  try {
    return await deleteDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, ref.path);
  }
};

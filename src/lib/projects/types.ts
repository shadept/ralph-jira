export interface ProjectMetadata {
	id: string;
	name: string;
	path: string;
	createdAt: string;
	updatedAt: string;
}

export interface CreateProjectInput {
	name: string;
	path: string;
}

export interface ProjectErrorDetails {
	projectId: string;
	message: string;
	details?: string;
}

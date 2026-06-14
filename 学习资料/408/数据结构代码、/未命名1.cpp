#include <iostream>
#include <stdlib.h>  // C 风格，也能用
#define ElemType int
#define N 10000

using namespace std;

int Partition(ElemType A[],int low,int high);
void HeadAdjust(ElemType A[],int k,int len);
ElemType *B = (ElemType *)malloc((N)*sizeof(ElemType));

//测试数据 
/*
20
42 5 17 88 5 -10 0 23 99 1 56 -3 7 88 12 -10 64 30 2 19
20 19 18 17 16 15 14 13 12 11 10 9 8 7 6 5 4 3 2 1
1 2 3 5 4 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20
计数排序测试数据
23 7 15 7 42 3 18 3 9 31 5 18 12 0 27 9 14 6 20 11 
*/

//工具函数 
void PrintStr(ElemType A[],int n){
	for(int i = 1;i < n + 1;i++){
		cout << A[i] << endl;
	}
}

void swap(int &a,int &b){
	int temp = a;
	a = b;
	b = temp;
}

//插入排序
void InsertSort(ElemType A[],int n){
	int i,j;
	for(i = 2;i <= n;i++){
		//一直找到对应位置再开始处理 
		if(A[i] < A[i-1]){
			A[0] = A[i];
			for(j = i - 1;A[0] < A[j];--j) A[j+1] = A[j];
			A[j + 1] = A[0];
		}
	}
} 

//折半插入排序 
//插入排序是顺序查找插入位置 这个是二分查找插入位置 找到后插入排序 
void InsertSortDivide(ElemType A[],int n) {
	int i,j,low,high,mid;
	for(i = 2;i <= n + 1;i++){
		A[0] = A[i];
		low = 1,high = i - 1;
		while(low <= high){
			mid = (low + high) / 2;
			if(A[mid] > A[0]) high = mid-1;
			else low = mid + 1;
		}
		
		//找到位置以后处理
		for(j = i-1;j >= high + 1;--j) A[j+1]  = A[j];
		A[high + 1] = A[0];
	}
}

//希尔排序 
void ShellSort(ElemType A[],int n){
	int i,j,dk;
	for(dk = n/2;dk >= 1;dk = dk/2){
		for(i = dk + 1;i <= n+1;i++){
		if(A[i] < A[i-dk]){
			A[0] = A[i];
			for(j = i - dk;j > 0 && A[0] < A[j];j = j - dk) A[j+dk] = A[j];
			A[j+dk] = A[0];
			}
		}
	}
} 

//冒泡排序
void  BubbleSort(ElemType A[],int n){
	for(int i = 1;i < n;i++){
		bool flag = false;
		for(int j = n;j > i;j--){
			if(A[j-1] > A[j]) {
				swap(A[j-1],A[j]);
				flag = true;
			}
		}
		if(flag == false) return;
	}
}

//快速排序 递归部分 
void QuickSort(ElemType A[],int low,int high){
	if(low < high){
		int p = Partition(A,low,high);
		QuickSort(A,low,p);
		QuickSort(A,p+1,high);
	} 
} 

//快速排序 划分部分
int Partition(ElemType A[],int low,int high){
	ElemType pivot = A[low];
	while(low < high){
		while(low < high && A[high] >= pivot) --high;
		A[low] = A[high];
		while(low < high && A[low] <= pivot) ++low;
		A[high] = A[low];
	}
	A[low] = pivot;
	return low;
}

//简单选择排序
void SelectSort(ElemType A[],int n){
	//由于程序给定的数组的第一个位置是哨兵位置 这里从1开始 
	for(int i = 1;i < n;i++){
		int min = i;
		for(int j = i + 1;j < n + 1;j++){
			if (A[j] < A[min]) min = j;
		}
		if(min != i) swap(A[i],A[min]);
	}	
} 

//建立大根堆  
void BuildMaxHeap(ElemType A[],int len){
	for(int i = len/2;i > 0;i--){
		HeadAdjust(A,i,len);
	}
}

void HeadAdjust(ElemType A[],int k,int len){
	A[0] = A[k];
	for(int i = 2*k;i <= len;i*=2){
		if(i < len&&A[i] < A[i+1]){
			i++;
		}
		if(A[0] >= A[i]) break;
		else{
			A[k] = A[i];
			k = i;
		}
	}
	
	A[k] = A[0];
} 

void HeapSort(ElemType A[],int len){
	for(int i = len;i > 1;i--){
		swap(A[i],A[1]);
		HeadAdjust(A,1,i-1);
	}
}

//归并排序 
void Merge(ElemType A[],int low,int mid,int high){
	int i,j,k;
	for(int k = low;k <= high;k++) B[k] = A[k];
	
	for(i = low,j = mid+1,k = i;i <= mid && j<= high;k++){
		if(B[i] <= B[j]) A[k] = B[i++];
		else A[k] = B[j++];
	}
	
	while(i <= mid) A[k++] = B[i++];
	while(j <= high) A[k++] = B[j++];
}

//归并排序的递归部分
void MergeSort(ElemType A[],int low,int high){
	if(low < high){
		int mid = (low+high)/2;
		MergeSort(A,low,mid);
		MergeSort(A,mid+1,high);
		Merge(A,low,mid,high);
	}
} 

//计数排序
void CountSort(ElemType A[],ElemType B[],int n,int k){
	int i,C[k];
	for(i = 0;i < k;i++){
		C[i] = 0;
	}
	for( i = 1;i <= n;i++) C[A[i]]++;
	for(i = 1;i < k ;i++){
		C[i] = C[i] + C[i-1];
	}
	for(i = n;i>=1;i--){
		B[C[A[i]] - 1] = A[i];
		C[A[i]] = C[A[i] - 1];
	}
	
	for (int i = 1; i <= n; i++)
        A[i] = B[i];
	
} 

int main(){
	int n;
	cin >> n;
	ElemType A[n + 1];
	for(int i = 1;i < n+1;i++){
		cin >> A[i];
	}
	
	InsertSort(A,n + 1); 
	//InsertSortDivide(A,n);
	//ShellSort(A,n);
	//BubbleSort(A,n);
	//QuickSort(A,1,n);
	//SelectSort(A,n); 
	//HeapSort(A,n);
	
	//归并排序 的 辅助数组建立
	//ElemType *B = (ElemType *)malloc((n+1)*sizeof(ElemType));
	//MergeSort(A,1,n+1);
	//CountSort(A,B,n,50);
	PrintStr(A,n+1);
	
	return 0;
} 

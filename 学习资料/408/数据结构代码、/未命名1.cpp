#include <iostream>
#define ElemType int

using namespace std;

//测试数据 
/*
20
42 5 17 88 5 -10 0 23 99 1 56 -3 7 88 12 -10 64 30 2 19
*/

void PrintStr(ElemType A[],int n){
	for(int i = 1;i < n + 1;i++){
		cout << A[i] << endl;
	}
}

//插入排序
void InsertSort(ElemType A[],int n){
	int i,j;
	for(int i = 2;i <= n;i++){
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


int main(){
	int n;
	cin >> n;
	ElemType A[n+1];
	for(int i = 1;i < n+1;i++){
		cin >> A[i];
	}
	
	//InsertSort(A,n); 
	//InsertSortDivide(A,n);
	ShellSort(A,n);
	PrintStr(A,n+1);
	
	return 0;
} 

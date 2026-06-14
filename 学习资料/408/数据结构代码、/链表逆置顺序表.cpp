#include<iostream>
#include<vector>

using namespace std;

void exchange(int &a,int &b){
	int t = b;
	b = a;
	a = t;
}

void Reverse(vector<int> &nums){
	for(int i = 0;i < nums.size()/2;i++){
		exchange(nums[i],nums[nums.size()-1-i]);
	}
}

void PrintList(vector<int> &nums){
	for(int i = 0;i < nums.size();i++){
		cout << nums[i] << " "; 
	}
	cout << endl;
}

int main(){
	int n,value;
	cin >> n;
	vector<int> nums(n);
	for(int i = 0;i < n;i++) cin >> nums[i];
	PrintList(nums); 
	Reverse(nums);
	PrintList(nums);
	return 0;
} 
